<?php

namespace App\Domain\Stock;

use App\Domain\Catalog\Models\Product;
use App\Domain\Stock\Models\ShopStock;
use App\Domain\Stock\Models\StockLot;
use App\Domain\Stock\Models\StockLotMovement;
use App\Domain\Stock\Models\StockMovement;
use App\Support\ApiException;
use App\Support\Decimal;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Arrivages des produits suivis (§7.11). Appelé par le StockLedger, dans sa
 * transaction et sous le verrou de la ligne `shop_stock` de l'article : la somme
 * des arrivages reste égale au stock, et aucun arrivage ne devient négatif.
 */
final class StockLots
{
    /** Annulation → opération d'origine dont on défait la répartition. */
    public const REVERSES = ['sale_cancel' => 'sale', 'adjustment_cancel' => 'adjustment', 'purchase_cancel' => 'purchase'];

    private const SOURCE_NOUN = ['purchase_cancel' => 'cet approvisionnement', 'adjustment_cancel' => 'ce mouvement', 'sale_cancel' => 'cette vente'];

    /** Entrée : nouvel arrivage. Sortie : l'arrivage visé, sinon les dates les plus proches d'abord. */
    public function apply(StockChange $change, array $meta, StockMovement $movement): void
    {
        if (Decimal::cmp($change->delta, '0') > 0) {
            $this->create($change, $change->delta, $change->expiryDate, $meta, $movement);

            return;
        }
        $need = Decimal::neg($change->delta);
        if ($change->lotId !== null) {
            $lot = $this->of($change)->lockForUpdate()->find($change->lotId);
            if (! $lot) {
                throw ApiException::invalid('items', 'Cet arrivage n’existe pas pour '.$change->product->articleName($change->variantId).'.');
            }
            if (Decimal::cmp((string) $lot->quantity, $need) < 0) {
                $message = sprintf('Il ne reste que %s %s de %s dans cet arrivage.', Decimal::human((string) $lot->quantity), $this->unit($change->product), $change->product->articleName($change->variantId));
                throw new ApiException(422, $message, ['items' => [$message]]);
            }
            $this->move($lot, Decimal::neg($need), $movement);

            return;
        }
        $this->takeEarliest($change, $need, $movement);
    }

    /**
     * Annulation : chaque quantité retourne dans l'arrivage d'où elle venait (ou en sort).
     * Retirer un arrivage déjà entamé est refusé : les dates restent justes (§7.11).
     *
     * @param  string  $total  variation totale de l'article dans cette annulation
     */
    public function reverse(StockChange $change, string $total, array $meta, StockMovement $movement): void
    {
        $original = self::REVERSES[$meta['source_type']];
        $parts = StockLotMovement::query()
            ->join('stock_movements', 'stock_movements.id', '=', 'stock_lot_movements.stock_movement_id')
            ->where('stock_movements.source_type', $original)->where('stock_movements.source_id', $meta['source_id'] ?? 0)
            ->where('stock_movements.shop_id', $change->shopId)->where('stock_movements.product_id', $change->product->id)
            ->whereRaw('stock_movements.product_variant_id IS NOT DISTINCT FROM ?', [$change->variantId])
            ->groupBy('stock_lot_movements.stock_lot_id')->orderBy('stock_lot_movements.stock_lot_id')
            ->selectRaw('stock_lot_movements.stock_lot_id as lot_id, sum(stock_lot_movements.quantity) as quantity')->get();

        $left = $total;
        foreach ($parts as $part) {
            $amount = Decimal::neg((string) $part->quantity);
            if (Decimal::cmp($amount, '0') === 0) {
                continue;
            }
            $lot = StockLot::query()->lockForUpdate()->findOrFail($part->lot_id);
            if (Decimal::cmp($amount, '0') < 0 && Decimal::cmp((string) $lot->quantity, Decimal::neg($amount)) < 0) {
                $gone = Decimal::sub(Decimal::neg($amount), (string) $lot->quantity);
                $message = sprintf(
                    '%s %s de %s de %s sont déjà vendus ou sortis du stock. Corrigez plutôt le stock par un inventaire.',
                    Decimal::human($gone), $this->unit($change->product), $change->product->articleName($change->variantId),
                    self::SOURCE_NOUN[$meta['source_type']] ?? 'cette opération',
                );
                throw new ApiException(422, $message, ['items' => [$message]]);
            }
            $this->move($lot, $amount, $movement);
            $left = Decimal::sub($left, $amount);
        }

        // Opération faite avant le suivi : rien à défaire, le reste suit la règle habituelle.
        if (Decimal::cmp($left, '0') > 0) {
            $this->create($change, $left, null, $meta, $movement);
        } elseif (Decimal::cmp($left, '0') < 0) {
            $this->takeEarliest($change, Decimal::neg($left), $movement);
        }
    }

    /** Début du suivi : le stock présent dans chaque boutique devient un arrivage sans date (§7.11). */
    public function startTracking(Product $product): void
    {
        DB::transaction(function () use ($product) {
            $rows = ShopStock::query()->where('product_id', $product->id)->orderBy('id')->lockForUpdate()->get();
            foreach ($rows as $row) {
                // Arrivages d'un suivi précédent : plus tenus pendant la pause, ils sont fermés.
                StockLot::query()->where('shop_id', $row->shop_id)->where('product_id', $product->id)
                    ->whereRaw('product_variant_id IS NOT DISTINCT FROM ?', [$row->product_variant_id])
                    ->where('quantity', '>', 0)->update(['quantity' => 0]);
                if (Decimal::cmp((string) $row->quantity, '0') > 0) {
                    $lot = StockLot::create([
                        'shop_id' => $row->shop_id, 'product_id' => $product->id, 'product_variant_id' => $row->product_variant_id,
                        'expiry_date' => null, 'initial_quantity' => $row->quantity, 'quantity' => $row->quantity,
                        'source_type' => 'tracking_start', 'received_at' => now(),
                    ]);
                    StockLotMovement::create(['stock_lot_id' => $lot->id, 'quantity' => $row->quantity]);
                }
            }
        });
    }

    /** Arrivages encore en stock d'un article, dans l'ordre de sortie : date la plus proche, puis sans date. */
    public static function open(int $shopId, int $productId, ?int $variantId): Builder
    {
        return StockLot::query()->where('shop_id', $shopId)->where('product_id', $productId)
            ->whereRaw('product_variant_id IS NOT DISTINCT FROM ?', [$variantId])
            ->where('quantity', '>', 0)
            ->orderByRaw('expiry_date ASC NULLS LAST')->orderBy('received_at')->orderBy('id');
    }

    private function of(StockChange $change): Builder
    {
        return StockLot::query()->where('shop_id', $change->shopId)->where('product_id', $change->product->id)
            ->whereRaw('product_variant_id IS NOT DISTINCT FROM ?', [$change->variantId]);
    }

    private function takeEarliest(StockChange $change, string $need, StockMovement $movement): void
    {
        foreach (self::open($change->shopId, $change->product->id, $change->variantId)->lockForUpdate()->get() as $lot) {
            if (Decimal::cmp($need, '0') <= 0) {
                break;
            }
            $part = Decimal::cmp((string) $lot->quantity, $need) < 0 ? (string) $lot->quantity : $need;
            $this->move($lot, Decimal::neg($part), $movement);
            $need = Decimal::sub($need, $part);
        }
        // Un reste ici voudrait dire des arrivages désaccordés du stock : le stock, lui, a été vérifié.
    }

    private function create(StockChange $change, string $quantity, ?string $expiryDate, array $meta, StockMovement $movement): void
    {
        $lot = StockLot::create([
            'shop_id' => $change->shopId, 'product_id' => $change->product->id, 'product_variant_id' => $change->variantId,
            'expiry_date' => $expiryDate, 'initial_quantity' => $quantity, 'quantity' => $quantity,
            'unit_cost' => $movement->unit_cost, 'source_type' => $meta['source_type'], 'source_id' => $meta['source_id'] ?? null,
            'reference' => $meta['reference'] ?? null, 'received_at' => $meta['occurred_at'] ?? now(),
        ]);
        StockLotMovement::create(['stock_lot_id' => $lot->id, 'stock_movement_id' => $movement->id, 'quantity' => $quantity]);
    }

    private function move(StockLot $lot, string $delta, StockMovement $movement): void
    {
        $lot->quantity = Decimal::add((string) $lot->quantity, $delta);
        $lot->save();
        StockLotMovement::create(['stock_lot_id' => $lot->id, 'stock_movement_id' => $movement->id, 'quantity' => $delta]);
    }

    private function unit(Product $product): string
    {
        return $product->unit?->short_name ?? '';
    }
}
