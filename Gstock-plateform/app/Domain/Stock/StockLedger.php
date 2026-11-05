<?php

namespace App\Domain\Stock;

use App\Domain\Catalog\Models\Product;
use App\Domain\Shops\Models\Shop;
use App\Domain\Stock\Models\ShopStock;
use App\Domain\Stock\Models\StockMovement;
use App\Support\ApiException;
use App\Support\Decimal;
use Illuminate\Support\Facades\DB;

/**
 * Registre du stock (§7.2) : seul point d'écriture de `shop_stock`.
 *
 * - La quantité est toujours égale à la somme des mouvements.
 * - Elle ne devient jamais négative : tout est vérifié avant d'écrire, sur des
 *   lignes verrouillées (`SELECT … FOR UPDATE`, dans un ordre fixe pour éviter les
 *   interblocages), et rien n'est écrit si une seule ligne passerait sous zéro.
 */
final class StockLedger
{
    public function __construct(private StockLots $lots) {}

    /**
     * @param  list<StockChange>  $changes
     * @param  array{source_type: string, source_id?: ?int, reference?: ?string, reason?: ?string, user_id?: ?int, occurred_at?: mixed}  $meta
     */
    public function apply(array $changes, array $meta): void
    {
        DB::transaction(function () use ($changes, $meta) {
            $changes = array_values(array_filter($changes, fn (StockChange $c) => $c->product->isStockable() && Decimal::cmp($c->delta, '0') !== 0));
            if (! $changes) {
                return;
            }

            // Deux lignes sur le même article : le contrôle porte sur leur total.
            $totals = [];
            foreach ($changes as $change) {
                $key = $change->key();
                $totals[$key] = ['change' => $change, 'delta' => Decimal::add($totals[$key]['delta'] ?? '0', $change->delta)];
            }
            ksort($totals);

            $rows = [];
            foreach ($totals as $key => ['change' => $change, 'delta' => $delta]) {
                $row = $this->lockRow($change->shopId, $change->product->id, $change->variantId);
                $after = Decimal::add((string) $row->quantity, $delta);
                if (Decimal::cmp($after, '0') < 0) {
                    $unit = $change->product->unit?->short_name ?? '';
                    $message = sprintf('Stock insuffisant : il reste %s %s de %s.', Decimal::human((string) $row->quantity), $unit, $change->product->articleName($change->variantId));
                    throw new ApiException(422, $message, ['items' => [$message]]);
                }
                $rows[$key] = $row;
            }

            $occurredAt = $meta['occurred_at'] ?? now();
            $meta['occurred_at'] = $occurredAt;
            $reversal = isset(StockLots::REVERSES[$meta['source_type']]);
            $reversed = [];
            foreach ($changes as $change) {
                $row = $rows[$change->key()];
                $row->quantity = Decimal::add((string) $row->quantity, $change->delta);
                $row->save();
                $movement = StockMovement::create([
                    'shop_id' => $change->shopId,
                    'product_id' => $change->product->id,
                    'product_variant_id' => $change->variantId,
                    'quantity' => $change->delta,
                    'unit_cost' => $change->unitCost ?? $this->costOf($change),
                    'source_type' => $meta['source_type'],
                    'source_id' => $meta['source_id'] ?? null,
                    'reference' => $meta['reference'] ?? null,
                    'reason' => $meta['reason'] ?? null,
                    'user_id' => $meta['user_id'] ?? null,
                    'occurred_at' => $occurredAt,
                ]);
                // Produit suivi : répartition sur les arrivages (§7.11), sous le verrou de la ligne.
                if ($change->product->track_expiry) {
                    if (! $reversal) {
                        $this->lots->apply($change, $meta, $movement);
                    } elseif (! isset($reversed[$change->key()])) {
                        $reversed[$change->key()] = true;
                        $this->lots->reverse($change, $totals[$change->key()]['delta'], $meta, $movement);
                    }
                }
            }
        });
    }

    /**
     * Quantité d'un article, ligne verrouillée jusqu'à la fin de la transaction
     * en cours (inventaire : l'écart reste exact face à une vente simultanée).
     */
    public function lockedQuantity(int $shopId, int $productId, ?int $variantId): string
    {
        return (string) $this->lockRow($shopId, $productId, $variantId)->quantity;
    }

    /** Quantité actuelle d'un article (sans verrou, pour l'affichage). */
    public function quantity(int $shopId, int $productId, ?int $variantId): string
    {
        return (string) (ShopStock::query()->where('shop_id', $shopId)->where('product_id', $productId)
            ->where('product_variant_id', $variantId)->value('quantity') ?? '0.000');
    }

    /** Lignes à 0 pour chaque article du produit dans chaque boutique (création d'un produit ou d'une variante, §7.2). */
    public function ensureRows(Product $product): void
    {
        $shops = Shop::query()->pluck('id');
        foreach ($product->stockKeys() as $variantId) {
            foreach ($shops as $shopId) {
                $this->insertRow($shopId, $product->id, $variantId);
            }
        }
    }

    /** Lignes à 0 pour tous les articles du catalogue dans une nouvelle boutique (§7.2). */
    public function ensureRowsForShop(Shop $shop): void
    {
        Product::query()->where('type', '!=', 'service')->with('variants')->each(function (Product $product) use ($shop) {
            foreach ($product->stockKeys() as $variantId) {
                $this->insertRow($shop->id, $product->id, $variantId);
            }
        });
    }

    private function lockRow(int $shopId, int $productId, ?int $variantId): ShopStock
    {
        $this->insertRow($shopId, $productId, $variantId);

        return ShopStock::query()->where('shop_id', $shopId)->where('product_id', $productId)
            ->where('product_variant_id', $variantId)->lockForUpdate()->firstOrFail();
    }

    private function insertRow(int $shopId, int $productId, ?int $variantId): void
    {
        DB::table('shop_stock')->insertOrIgnore([
            'tenant_id' => tenant('id'), 'shop_id' => $shopId, 'product_id' => $productId, 'product_variant_id' => $variantId,
            'quantity' => 0, 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    private function costOf(StockChange $change): ?string
    {
        $variant = $change->variantId ? $change->product->variants->firstWhere('id', $change->variantId) : null;
        $cost = $variant?->cost ?? $change->product->cost;

        return $cost === null ? null : (string) $cost;
    }
}
