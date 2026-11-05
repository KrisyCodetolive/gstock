<?php

namespace App\Domain\Stock;

use App\Domain\Audit\Audit;
use App\Domain\Catalog\Article;
use App\Domain\Catalog\Models\Product;
use App\Domain\Identity\Models\User;
use App\Domain\Shops\Models\Shop;
use App\Domain\Stock\Models\Adjustment;
use App\Support\ApiException;
use App\Support\Decimal;
use App\Support\DocumentSequence;
use Illuminate\Support\Facades\DB;

/**
 * Mouvements manuels MS-N (M07) : entrée, sortie (perte, casse…), inventaire
 * (écart entre le compté et le stock). Annulables avec un motif, jamais supprimés.
 */
final class AdjustmentService
{
    private const PERMISSION = ['entry' => 'stock.entry', 'exit' => 'stock.exit', 'inventory' => 'stock.adjust'];

    /** Motifs d'une sortie (§7.11) ; périmé, cassé et volé sont des pertes (§7.8). */
    public const EXIT_REASONS = ['expired', 'damaged', 'stolen', 'consumed', 'other'];

    public const LOSS_REASONS = ['expired', 'damaged', 'stolen'];

    public function __construct(private StockLedger $ledger) {}

    public function create(Shop $shop, User $user, array $in): Adjustment
    {
        $kind = $in['kind'] ?? null;
        if (! in_array($kind, Adjustment::KINDS, true)) {
            throw ApiException::invalid('kind', 'Type de mouvement inconnu.');
        }
        if (! $user->hasAnyPermission(self::PERMISSION[$kind])) {
            throw ApiException::forbidden();
        }
        // Idempotence hors ligne : un second envoi renvoie l'opération déjà enregistrée (ADR-005).
        if (filled($in['offline_uuid'] ?? null) && $existing = Adjustment::query()->where('offline_uuid', $in['offline_uuid'])->first()) {
            return $existing;
        }

        $errors = [];
        $reason = trim((string) ($in['reason'] ?? ''));
        if ($reason === '') {
            $errors['reason'][] = 'Indiquez le motif du mouvement.';
        }
        $exitReason = $kind === 'exit' ? ($in['exit_reason'] ?? 'other') : null;
        if ($exitReason !== null && ! in_array($exitReason, self::EXIT_REASONS, true)) {
            $errors['exit_reason'][] = 'Choisissez le motif de la sortie.';
        }
        $items = array_values((array) ($in['items'] ?? []));
        if (! $items) {
            $errors['items'][] = 'Ajoutez au moins un produit.';
        }
        // Deux lignes d'un même article : permises pour deux dates (entrée) ou deux arrivages (sortie).
        $keys = array_map(fn ($i) => ((int) ($i['product_id'] ?? 0)).':'.($i['variant_id'] ?? '')
            .($kind === 'entry' ? ':'.($i['expiry_date'] ?? '') : '').($kind === 'exit' ? ':'.($i['stock_lot_id'] ?? '') : ''), $items);
        if (count(array_unique($keys)) !== count($keys)) {
            $errors['items'][] = 'Un même produit apparaît deux fois.';
        }
        $products = Product::query()->with(['variants', 'unit'])->whereKey(array_map(fn ($i) => (int) ($i['product_id'] ?? 0), $items))->get()->keyBy('id');

        return DB::transaction(function () use ($shop, $user, $kind, $reason, $exitReason, $items, $products, $errors, $in) {
            $lines = [];
            foreach ($items as $item) {
                $product = $products->get((int) ($item['product_id'] ?? 0));
                if (! $product || ! $product->isStockable() || ! $product->is_active) {
                    $errors['items'][] = 'Un des produits ne peut pas être stocké.';

                    continue;
                }
                try {
                    $article = Article::resolve($product, $item['variant_id'] ?? null);
                } catch (ApiException $e) {
                    $errors['items'][] = $e->errors['items'][0];

                    continue;
                }
                // Date de péremption (entrée, inventaire) ou arrivage visé (sortie) : produits suivis seulement (§7.11).
                $expiry = Expiry::parse($item['expiry_date'] ?? null);
                if ($expiry === false) {
                    $errors['items'][] = "La date de péremption de {$article->name()} n’est pas valide.";

                    continue;
                }
                $expiry = $product->track_expiry && $kind !== 'exit' ? $expiry : null;
                $lotId = $product->track_expiry && $kind === 'exit' && filled($item['stock_lot_id'] ?? null) ? (int) $item['stock_lot_id'] : null;
                // Ligne verrouillée : l'écart d'inventaire reste exact face à une vente simultanée.
                $current = $this->ledger->lockedQuantity($shop->id, $product->id, $article->variantId());
                if ($kind === 'inventory') {
                    $counted = Decimal::parse($item['counted_quantity'] ?? null);
                    if ($counted === null || Decimal::cmp($counted, '0') < 0) {
                        $errors['items'][] = "Saisissez la quantité comptée pour {$article->name()}.";

                        continue;
                    }
                    $delta = Decimal::sub($counted, $current);
                    $lines[] = [$article, $delta, $delta, $counted, Decimal::cmp($delta, '0') > 0 ? $expiry : null, null];
                } else {
                    $quantity = Decimal::parse($item['quantity'] ?? null);
                    if ($quantity === null || Decimal::cmp($quantity, '0') <= 0) {
                        $errors['items'][] = "Saisissez une quantité supérieure à 0 pour {$article->name()}.";

                        continue;
                    }
                    $lines[] = [$article, $kind === 'entry' ? $quantity : Decimal::neg($quantity), $quantity, null, $expiry, $lotId];
                }
            }
            if ($errors) {
                throw new ApiException(422, 'Les informations saisies ne sont pas valides.', $errors);
            }

            // Numéro pris dans la transaction : un échec l'annule aussi, sans trou dans la suite.
            $reference = DocumentSequence::reference('MS');
            $adjustment = Adjustment::create([
                'shop_id' => $shop->id,
                'reference' => $reference,
                'kind' => $kind,
                'reason' => $reason,
                'exit_reason' => $exitReason,
                'occurred_at' => now(),
                'user_id' => $user->id,
                'offline_uuid' => $in['offline_uuid'] ?? null,
            ]);
            $this->ledger->apply(
                array_map(fn ($l) => new StockChange($shop->id, $l[0]->product, $l[0]->variantId(), $l[1], expiryDate: $l[4], lotId: $l[5]), $lines),
                ['source_type' => 'adjustment', 'source_id' => $adjustment->id, 'reference' => $reference, 'reason' => $reason, 'user_id' => $user->id, 'occurred_at' => $adjustment->occurred_at],
            );
            foreach ($lines as [$article, $delta, $quantity, $counted, $expiry, $lotId]) {
                $adjustment->items()->create([
                    'product_id' => $article->product->id,
                    'product_variant_id' => $article->variantId(),
                    'quantity' => $kind === 'inventory' ? $delta : $quantity,
                    'counted_quantity' => $counted,
                    'expiry_date' => $expiry,
                    'stock_lot_id' => $lotId,
                ]);
            }
            Audit::record($user, 'stock.adjusted', [
                'shop_id' => $shop->id, 'subject' => $adjustment, 'label' => $reference, 'reason' => $reason,
                'new' => [
                    'type' => ['entry' => 'Ajout', 'exit' => 'Retrait', 'inventory' => 'Inventaire'][$kind],
                    'produits' => array_map(fn ($l) => ['produit' => $l[0]->name(), 'quantite' => (float) $l[1]], $lines),
                ],
            ]);

            return $adjustment;
        });
    }

    /** Annulation : motif obligatoire, mouvements inverses, jamais de stock négatif (ADR-012, §7.2). */
    public function cancel(Adjustment $adjustment, User $user, ?string $reason): Adjustment
    {
        if ($adjustment->status === 'cancelled') {
            throw ApiException::conflict('Ce mouvement a déjà été annulé.');
        }
        $reason = trim((string) $reason);
        if ($reason === '') {
            throw ApiException::invalid('reason', 'Indiquez pourquoi vous annulez ce mouvement.');
        }

        return DB::transaction(function () use ($adjustment, $user, $reason) {
            $adjustment = Adjustment::query()->lockForUpdate()->findOrFail($adjustment->id);
            if ($adjustment->status === 'cancelled') {
                throw ApiException::conflict('Ce mouvement a déjà été annulé.');
            }
            $adjustment->load('items.product.variants', 'items.product.unit');
            $this->ledger->apply($adjustment->items->map(function ($item) use ($adjustment) {
                $applied = $adjustment->kind === 'exit' ? Decimal::neg((string) $item->quantity) : (string) $item->quantity;

                return new StockChange($adjustment->shop_id, $item->product, $item->product_variant_id, Decimal::neg($applied));
            })->all(), [
                'source_type' => 'adjustment_cancel', 'source_id' => $adjustment->id, 'reference' => $adjustment->reference,
                'reason' => "Annulation : {$reason}", 'user_id' => $user->id,
            ]);
            $adjustment->update(['status' => 'cancelled', 'cancelled_at' => now(), 'cancelled_by' => $user->id, 'cancel_reason' => $reason]);
            Audit::record($user, 'stock.adjustment_cancelled', ['shop_id' => $adjustment->shop_id, 'subject' => $adjustment, 'label' => $adjustment->reference, 'reason' => $reason]);

            return $adjustment;
        });
    }
}
