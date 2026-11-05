<?php

namespace App\Domain\Purchases;

use App\Domain\Audit\Audit;
use App\Domain\Catalog\Article;
use App\Domain\Catalog\Models\Product;
use App\Domain\Catalog\Models\Unit;
use App\Domain\Credits\InstallmentSchedule;
use App\Domain\Identity\Models\User;
use App\Domain\Purchases\Models\Purchase;
use App\Domain\Purchases\Models\Supplier;
use App\Domain\Sales\Models\PaymentMethod;
use App\Domain\Shops\Models\Shop;
use App\Domain\Stock\Expiry;
use App\Domain\Stock\StockChange;
use App\Domain\Stock\StockLedger;
use App\Support\ApiException;
use App\Support\Decimal as D;
use App\Support\DocumentSequence;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * Approvisionnements AP-N (M11) : montants recalculés par le serveur (§7.4),
 * entrée en stock en unité de base (§7.3), paiements au fournisseur jamais
 * au-delà du reste dû, échéancier facultatif (§7.7), annulation motivée qui
 * retire la marchandise du stock sans jamais le rendre négatif (§7.2, ADR-012).
 */
final class PurchaseService
{
    public function __construct(private StockLedger $ledger) {}

    /**
     * Montants d'un approvisionnement, sans rien enregistrer.
     *
     * @return array{items: list<array{article: Article, unit: Unit, factor: string, quantity: string, base_quantity: string, cost: string, subtotal: string}>, subtotal: string, discount: string, total: string}
     */
    public function compute(array $in): array
    {
        $lines = array_values((array) ($in['items'] ?? []));
        $errors = [];
        if (! $lines) {
            throw ApiException::invalid('items', 'Ajoutez au moins un produit.');
        }
        // Un même article sur deux lignes : permis seulement pour deux dates de péremption (§7.11).
        $keys = array_map(fn ($l) => ((int) ($l['product_id'] ?? 0)).':'.($l['variant_id'] ?? '').':'.($l['expiry_date'] ?? ''), $lines);
        if (count(array_unique($keys)) !== count($keys)) {
            throw ApiException::invalid('items', 'Un même produit apparaît deux fois avec la même date.');
        }

        $products = Product::query()->with(['variants', 'unit'])->whereIn('id', array_map(fn ($l) => (int) ($l['product_id'] ?? 0), $lines))->get()->keyBy('id');
        $units = Unit::query()->get()->keyBy('id');
        $items = [];
        foreach ($lines as $l) {
            $product = $products[(int) ($l['product_id'] ?? 0)] ?? null;
            if (! $product || ! $product->is_active || ! $product->isStockable()) {
                $errors[] = 'Un des produits ne peut pas être approvisionné.';

                continue;
            }
            // Produit à variantes : on achète une variante précise (son stock, son prix d'achat).
            $article = Article::resolve($product, $l['variant_id'] ?? null);
            $quantity = D::parse($l['quantity'] ?? null);
            $cost = D::parse($l['cost'] ?? null);
            if ($quantity === null || D::cmp($quantity, '0') <= 0) {
                $errors[] = "Saisissez une quantité supérieure à 0 pour {$article->name()}.";
            }
            if ($cost === null || D::cmp($cost, '0') < 0) {
                $errors[] = "Saisissez le prix d'achat de {$article->name()}.";
            }
            // Unité de la ligne : l'unité de base du produit ou une de ses unités dérivées actives (§7.3).
            $unit = filled($l['unit_id'] ?? null) ? ($units[(int) $l['unit_id']] ?? null) : $units[$product->unit_id] ?? null;
            if ($unit && $unit->id !== $product->unit_id && ($unit->base_unit_id !== $product->unit_id || ! $unit->is_active)) {
                $unit = null;
            }
            if (! $unit) {
                $errors[] = "Cette unité ne convient pas pour {$product->name}.";

                continue;
            }
            $expiry = Expiry::parse($l['expiry_date'] ?? null);
            if ($expiry === false) {
                $errors[] = "La date de péremption de {$article->name()} n’est pas valide.";

                continue;
            }
            if ($quantity === null || $cost === null) {
                continue;
            }
            $factor = $unit->factor();
            $items[] = [
                'article' => $article,
                'unit' => $unit,
                'factor' => $factor,
                'quantity' => D::format($quantity, D::QTY),
                // Le stock est tenu en unité de base, arrondi au millième (§7.2).
                'base_quantity' => D::round(D::mul($quantity, $factor, 9), D::QTY),
                'cost' => D::round($cost, D::MONEY),
                'subtotal' => D::round(D::mul($quantity, $cost, 6), D::MONEY),
                // Facultative, gardée pour les produits suivis seulement.
                'expiry_date' => $product->track_expiry ? $expiry : null,
            ];
        }
        if ($errors) {
            throw new ApiException(422, 'Les informations saisies ne sont pas valides.', ['items' => array_values(array_unique($errors))]);
        }

        $subtotal = array_reduce($items, fn ($s, $i) => D::add($s, $i['subtotal'], D::MONEY), '0.00');
        $discount = filled($in['discount'] ?? null) ? D::parse($in['discount']) : '0';
        if ($discount === null || D::cmp($discount, '0') < 0 || D::cmp($discount, $subtotal) > 0) {
            throw ApiException::invalid('discount', 'La remise ne peut pas dépasser le total.');
        }
        $discount = D::round($discount, D::MONEY);

        return ['items' => $items, 'subtotal' => $subtotal, 'discount' => $discount, 'total' => D::sub($subtotal, $discount, D::MONEY)];
    }

    /** Enregistre un approvisionnement : le stock augmente tout de suite, un premier paiement est possible. */
    public function record(Shop $shop, User $user, array $in, ?CarbonInterface $at = null): Purchase
    {
        $c = $this->compute($in);
        $errors = [];
        $supplier = null;
        if (filled($in['supplier_id'] ?? null)) {
            $supplier = Supplier::query()->where('is_active', true)->find((int) $in['supplier_id']);
            if (! $supplier) {
                $errors['supplier_id'] = ['Ce fournisseur n’existe pas.'];
            }
        }
        $occurredAt = $at ?? (filled($in['occurred_at'] ?? null) ? now()->parse($in['occurred_at']) : now());
        if ($occurredAt->isFuture()) {
            $errors['occurred_at'] = ['La date ne peut pas être dans le futur.'];
        }
        $paid = filled($in['paid_amount'] ?? null) ? (D::parse($in['paid_amount']) ?? '-1') : '0';
        if (D::cmp($paid, '0') !== 0) {
            $errors += $this->checkPayment($paid, $in['payment_method_id'] ?? null, $c['total']);
        }
        if ($errors) {
            throw new ApiException(422, 'Les informations saisies ne sont pas valides.', $errors);
        }

        return DB::transaction(function () use ($shop, $user, $in, $c, $supplier, $occurredAt, $paid) {
            $reference = DocumentSequence::reference('AP');
            $paid = D::round($paid, D::MONEY);
            $purchase = Purchase::create([
                'shop_id' => $shop->id,
                'supplier_id' => $supplier?->id,
                'reference' => $reference,
                'occurred_at' => $occurredAt,
                'subtotal' => $c['subtotal'],
                'discount' => $c['discount'],
                'total' => $c['total'],
                'paid_amount' => $paid,
                'payment_status' => self::paymentStatus($c['total'], $paid),
                'status' => 'received',
                'user_id' => $user->id,
                'note' => filled($in['note'] ?? null) ? trim((string) $in['note']) : null,
            ]);
            $changes = [];
            foreach ($c['items'] as $i) {
                $purchase->items()->create([
                    'product_id' => $i['article']->product->id,
                    'product_variant_id' => $i['article']->variantId(),
                    'unit_id' => $i['unit']->id,
                    'quantity' => $i['quantity'],
                    'base_quantity' => $i['base_quantity'],
                    'cost' => $i['cost'],
                    'subtotal' => $i['subtotal'],
                    'expiry_date' => $i['expiry_date'],
                ]);
                // Le prix d'achat est tenu par unité de base : prix du carton ÷ 12.
                $unitCost = D::round(D::div($i['cost'], $i['factor'], 6), D::MONEY);
                $changes[] = new StockChange($shop->id, $i['article']->product, $i['article']->variantId(), $i['base_quantity'], $unitCost, $i['expiry_date']);
                if (! empty($in['update_costs'])) {
                    ($i['article']->variant ?? $i['article']->product)->update(['cost' => $unitCost]);
                }
            }
            // Entrée en stock (§7.2), mouvement « purchase ».
            $this->ledger->apply($changes, [
                'source_type' => 'purchase', 'source_id' => $purchase->id, 'reference' => $reference,
                'reason' => $supplier?->name, 'user_id' => $user->id, 'occurred_at' => $occurredAt,
            ]);
            if (D::cmp($paid, '0') > 0) {
                $purchase->payments()->create([
                    'payment_method_id' => (int) $in['payment_method_id'], 'amount' => $paid, 'paid_at' => $occurredAt, 'user_id' => $user->id,
                ]);
            }

            return $purchase;
        });
    }

    /** Paiement ultérieur au fournisseur, jamais au-delà du reste dû. */
    public function addPayment(Purchase $purchase, User $user, array $in): Purchase
    {
        return DB::transaction(function () use ($purchase, $user, $in) {
            $purchase = Purchase::query()->lockForUpdate()->findOrFail($purchase->id);
            if ($purchase->status === 'cancelled') {
                throw ApiException::conflict('Cet approvisionnement est annulé.');
            }
            $amount = D::parse($in['amount'] ?? null) ?? '0';
            $errors = $this->checkPayment($amount, $in['payment_method_id'] ?? null, self::due($purchase));
            $paidAt = filled($in['paid_at'] ?? null) ? now()->parse($in['paid_at']) : now();
            if ($paidAt->isFuture()) {
                $errors['paid_at'] = ['La date ne peut pas être dans le futur.'];
            }
            if ($errors) {
                throw new ApiException(422, 'Les informations saisies ne sont pas valides.', $errors);
            }
            $amount = D::round($amount, D::MONEY);
            $purchase->payments()->create([
                'payment_method_id' => (int) $in['payment_method_id'], 'amount' => $amount, 'paid_at' => $paidAt, 'user_id' => $user->id,
                'note' => filled($in['note'] ?? null) ? trim((string) $in['note']) : null,
            ]);
            $paid = D::add((string) $purchase->paid_amount, $amount, D::MONEY);
            $purchase->update(['paid_amount' => $paid, 'payment_status' => self::paymentStatus((string) $purchase->total, $paid)]);

            return $purchase;
        });
    }

    /** Échéancier du reste dû au fournisseur (§7.7) : remplace les échéances non payées. */
    public function setInstallments(Purchase $purchase, array $items): void
    {
        DB::transaction(function () use ($purchase, $items) {
            $purchase = Purchase::query()->lockForUpdate()->findOrFail($purchase->id);
            $due = self::due($purchase);
            if ($purchase->status === 'cancelled' || D::cmp($due, '0') <= 0) {
                throw ApiException::conflict('Cet approvisionnement n’a plus de reste à payer.');
            }
            InstallmentSchedule::replace(Purchase::PAYABLE, $purchase->id, $due, $items);
        });
    }

    /** Annulation : la marchandise sort du stock (refusé s'il deviendrait négatif) ; l'approvisionnement reste visible. */
    public function cancel(Purchase $purchase, User $user, ?string $reason): Purchase
    {
        $reason = trim((string) $reason);
        if ($reason === '') {
            throw ApiException::invalid('reason', 'Indiquez pourquoi vous annulez cet approvisionnement.');
        }

        return DB::transaction(function () use ($purchase, $user, $reason) {
            $purchase = Purchase::query()->lockForUpdate()->with('items.product.variants')->findOrFail($purchase->id);
            if ($purchase->status === 'cancelled') {
                throw ApiException::conflict('Cet approvisionnement a déjà été annulé.');
            }
            $this->ledger->apply(
                $purchase->items->map(fn ($i) => new StockChange($purchase->shop_id, $i->product, $i->product_variant_id, D::neg((string) $i->base_quantity)))->all(),
                ['source_type' => 'purchase_cancel', 'source_id' => $purchase->id, 'reference' => $purchase->reference, 'reason' => "Annulation : {$reason}", 'user_id' => $user->id],
            );
            $purchase->update(['status' => 'cancelled', 'cancelled_at' => now(), 'cancelled_by' => $user->id, 'cancel_reason' => $reason]);
            Audit::record($user, 'purchase.cancelled', [
                'shop_id' => $purchase->shop_id, 'subject' => $purchase, 'label' => $purchase->reference, 'reason' => $reason,
                'old' => ['total' => (float) $purchase->total],
            ]);

            return $purchase;
        });
    }

    /** Reste dû au fournisseur ; 0 pour un approvisionnement annulé. */
    public static function due(Purchase $p): string
    {
        if ($p->status === 'cancelled') {
            return '0.00';
        }
        $due = D::sub((string) $p->total, (string) $p->paid_amount, D::MONEY);

        return D::cmp($due, '0') > 0 ? $due : '0.00';
    }

    public static function paymentStatus(string $total, string $paid): string
    {
        if (D::cmp(D::sub($total, $paid, D::MONEY), '0') <= 0) {
            return 'paid';
        }

        return D::cmp($paid, '0') === 0 ? 'unpaid' : 'partial';
    }

    /** @return array<string, list<string>> */
    private function checkPayment(string $amount, mixed $methodId, string $due): array
    {
        $errors = [];
        if (D::cmp($amount, '0') <= 0) {
            $errors['paid_amount'][] = 'Saisissez un montant supérieur à 0.';
        } elseif (D::cmp($amount, $due) > 0) {
            $errors['paid_amount'][] = sprintf('Il ne reste que %s FCFA à payer.', InstallmentSchedule::fr($due));
        }
        if (! PaymentMethod::query()->where('is_active', true)->whereKey((int) $methodId)->exists()) {
            $errors['payment_method_id'] = ['Choisissez le mode de paiement.'];
        }

        return $errors;
    }
}
