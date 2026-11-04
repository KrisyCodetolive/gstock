<?php

namespace App\Domain\Sales;

use App\Domain\Audit\Audit;
use App\Domain\Credits\Models\CustomerCredit;
use App\Domain\Customers\Models\Customer;
use App\Domain\Identity\Models\User;
use App\Domain\Sales\Models\Sale;
use App\Domain\Shops\Models\Shop;
use App\Domain\Shops\Models\TenantPaymentSetting;
use App\Domain\Stock\StockChange;
use App\Domain\Stock\StockLedger;
use App\Support\ApiException;
use App\Support\Decimal as D;
use App\Support\DocumentSequence;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * Ventes (M08) : enregistrement « en transaction » (stock, paiements, crédit
 * client si un reste existe, §7.1, §7.5) et annulation motivée (ADR-012).
 */
final class SaleService
{
    public function __construct(private SaleCalculator $calculator, private StockLedger $ledger) {}

    /** @param  ?CarbonInterface  $at  date de la vente (données de démonstration) ; par défaut maintenant */
    public function record(Shop $shop, User $user, array $input, bool $offline = false, ?CarbonInterface $at = null): Sale
    {
        // Idempotence : un second envoi renvoie la vente déjà enregistrée (ADR-005).
        if (filled($input['offline_uuid'] ?? null) && $existing = Sale::query()->where('offline_uuid', $input['offline_uuid'])->first()) {
            return $existing;
        }
        $c = $this->calculator->compute($input, $user, $offline);

        $customer = null;
        if (filled($input['customer_id'] ?? null)) {
            $customer = Customer::query()->where('is_active', true)->find((int) $input['customer_id']);
            if (! $customer) {
                throw ApiException::invalid('customer_id', 'Ce client n’existe pas.');
            }
        }
        if (D::cmp($c->creditAmount, '0') > 0) {
            // Un reste à payer exige un client identifiable (§7.1) et le droit de mettre à crédit.
            if (! $customer) {
                throw new ApiException(422, 'Choisissez un client pour mettre à crédit.', ['customer_id' => ['Choisissez un client pour mettre à crédit.']]);
            }
            if (! $user->hasAnyPermission('credits.create')) {
                throw ApiException::forbidden("Vous n'avez pas le droit de mettre à crédit.");
            }
        }
        $fromNote = array_reduce(array_filter($c->payments, fn ($p) => $p['credit_note']), fn ($s, $p) => D::add($s, $p['amount'], D::MONEY), '0.00');
        if (D::cmp($fromNote, '0') > 0) {
            if (! $customer) {
                throw new ApiException(422, 'Choisissez le client pour utiliser son avoir.', ['customer_id' => ['Choisissez le client pour utiliser son avoir.']]);
            }
            // Les avoirs (décision P3) arrivent avec le module Crédits : aucun avoir disponible pour l'instant.
            $message = "L'avoir du client n'est que de 0 FCFA.";
            throw new ApiException(422, $message, ['payments' => [$message]]);
        }

        return DB::transaction(function () use ($shop, $user, $input, $c, $customer, $offline, $at) {
            $reference = DocumentSequence::reference('V');
            $occurredAt = $at ?? ($offline && filled($input['occurred_at'] ?? null) ? $input['occurred_at'] : now());
            $sale = Sale::create([
                'shop_id' => $shop->id,
                'reference' => $reference,
                'offline_uuid' => $input['offline_uuid'] ?? null,
                'occurred_at' => $occurredAt,
                'customer_id' => $customer?->id,
                'user_id' => $user->id,
                'subtotal' => $c->subtotal,
                'discount' => $c->discount,
                'tax_amount' => $c->taxAmount,
                'total' => $c->total,
                'paid_now' => $c->paidNow,
                'credit_amount' => $c->creditAmount,
                'payment_status' => $c->paymentStatus,
                'status' => 'completed',
                'note' => filled($input['note'] ?? null) ? trim($input['note']) : null,
            ]);

            // Le stock diminue dès la validation, payée ou à crédit (§7.1).
            $reasons = $c->priceChanges;
            $changes = [];
            foreach ($c->items as $i) {
                $article = $i['article'];
                $delta = D::neg($i['quantity']);
                if ($offline && $article->product->isStockable()) {
                    // Vente synchronisée (P2) : enregistrée même si le stock a baissé entre-temps,
                    // mais le stock ne descend jamais sous 0 ; l'écart est « à vérifier ».
                    $available = $this->ledger->lockedQuantity($shop->id, $article->product->id, $article->variantId());
                    if (D::cmp($available, $i['quantity']) < 0) {
                        $unit = $article->product->unit?->short_name ?? '';
                        $reasons[] = sprintf('Stock insuffisant pour %s : %s %s vendus, %s %s en stock à la synchronisation. Faites un inventaire.',
                            $article->name(), D::human($i['quantity']), $unit, D::human($available), $unit);
                        $delta = D::neg($available);
                    }
                }
                $changes[] = new StockChange($shop->id, $article->product, $article->variantId(), $delta, $i['unit_cost']);
                $sale->items()->create([
                    'product_id' => $article->product->id,
                    'product_variant_id' => $article->variantId(),
                    'unit_id' => $article->product->unit_id,
                    'quantity' => $i['quantity'],
                    'base_quantity' => $i['quantity'],
                    'price' => $i['price'],
                    'unit_cost' => $i['unit_cost'],
                    'discount' => $i['discount'],
                    'discount_method' => $i['discount_method'],
                    'discount_amount' => $i['discount_amount'],
                    'tax_rate' => $i['tax_rate'],
                    'tax_amount' => $i['tax_amount'],
                    'subtotal' => $i['subtotal'],
                ]);
            }
            $this->ledger->apply($changes, ['source_type' => 'sale', 'source_id' => $sale->id, 'reference' => $reference, 'user_id' => $user->id, 'occurred_at' => $occurredAt]);
            if ($offline) {
                $sale->update(['sync_status' => $reasons ? 'to_review' : 'ok', 'review_reasons' => $reasons]);
            }

            // GeniusPay : validé seulement à réception du webhook (ADR-003).
            $geniuspay = (bool) TenantPaymentSetting::query()->value('is_active');
            foreach ($c->payments as $p) {
                $sale->payments()->create([
                    'payment_method_id' => $p['method']?->id,
                    'amount' => $p['amount'],
                    'cash_given' => $p['cash_given'],
                    'change' => $p['change'],
                    'status' => $geniuspay && $p['method']?->uses_geniuspay ? 'pending' : 'completed',
                ]);
            }

            // Montant à crédit > 0 : crédit client automatique, même référence que la vente (§7.5).
            if (D::cmp($c->creditAmount, '0') > 0) {
                CustomerCredit::create([
                    'shop_id' => $shop->id,
                    'customer_id' => $customer->id,
                    'sale_id' => $sale->id,
                    'reference' => $reference,
                    'occurred_at' => $occurredAt,
                    'amount' => $c->creditAmount,
                    'remaining_amount' => $c->creditAmount,
                    'is_opening_balance' => false,
                    'status' => 'open',
                    'user_id' => $user->id,
                ]);
            }

            // Prix modifié à la caisse : action sensible (M14).
            $changed = array_values(array_filter($c->items, fn ($i) => D::cmp($i['price'], $i['catalog_price']) !== 0));
            if ($changed && ! $offline) {
                Audit::record($user, 'sale.price_changed', [
                    'shop_id' => $shop->id, 'subject' => $sale, 'label' => $reference,
                    'old' => ['prix' => array_map(fn ($i) => ['produit' => $i['article']->name(), 'prix' => (float) $i['catalog_price']], $changed)],
                    'new' => ['prix' => array_map(fn ($i) => ['produit' => $i['article']->name(), 'prix' => (float) $i['price']], $changed)],
                ]);
            }

            return $sale;
        });
    }

    /**
     * Annulation (ADR-012) : motif obligatoire, stock restitué, paiements et crédit
     * annulés. Si le crédit a déjà reçu des paiements, le choix « avoir ou argent
     * rendu » (P3) arrivera avec le module Crédits.
     */
    public function cancel(Sale $sale, User $user, ?string $reason): Sale
    {
        $reason = trim((string) $reason);
        if ($reason === '') {
            throw ApiException::invalid('reason', 'Indiquez pourquoi vous annulez cette vente.');
        }

        return DB::transaction(function () use ($sale, $user, $reason) {
            $sale = Sale::query()->lockForUpdate()->findOrFail($sale->id);
            if ($sale->status === 'cancelled') {
                throw ApiException::conflict('Cette vente a déjà été annulée.');
            }
            $sale->load(['items.product.variants', 'items.product.unit', 'payments']);
            $credit = CustomerCredit::query()->where('sale_id', $sale->id)->where('status', '!=', 'cancelled')->lockForUpdate()->first();
            if ($credit && D::cmp((string) $credit->remaining_amount, (string) $credit->amount) < 0) {
                throw ApiException::conflict('Ce crédit a déjà reçu un paiement : annulez d’abord le paiement.');
            }

            $this->ledger->apply($sale->items->map(fn ($i) => new StockChange(
                $sale->shop_id, $i->product, $i->product_variant_id, (string) $i->base_quantity, $i->unit_cost === null ? null : (string) $i->unit_cost,
            ))->all(), [
                'source_type' => 'sale_cancel', 'source_id' => $sale->id, 'reference' => $sale->reference,
                'reason' => "Annulation : {$reason}", 'user_id' => $user->id,
            ]);
            $sale->update(['status' => 'cancelled', 'cancelled_at' => now(), 'cancelled_by' => $user->id, 'cancel_reason' => $reason]);
            $sale->payments()->update(['status' => 'cancelled']);
            $credit?->update(['status' => 'cancelled', 'remaining_amount' => 0, 'cancelled_at' => now(), 'cancelled_by' => $user->id, 'cancel_reason' => $reason]);

            Audit::record($user, 'sale.cancelled', [
                'shop_id' => $sale->shop_id, 'subject' => $sale, 'label' => $sale->reference, 'reason' => $reason,
                'old' => ['statut' => 'Validée', 'total' => (float) $sale->total],
                'new' => ['statut' => 'Annulée'],
            ]);

            return $sale;
        });
    }
}
