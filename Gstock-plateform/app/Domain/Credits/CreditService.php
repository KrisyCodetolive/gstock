<?php

namespace App\Domain\Credits;

use App\Domain\Audit\Audit;
use App\Domain\Credits\Models\CreditAdjustment;
use App\Domain\Credits\Models\CustomerCredit;
use App\Domain\Credits\Models\CustomerRefund;
use App\Domain\Customers\Models\Customer;
use App\Domain\Identity\Models\User;
use App\Domain\Sales\Models\PaymentMethod;
use App\Domain\Shops\Models\Shop;
use App\Support\ApiException;
use App\Support\Decimal as D;
use App\Support\DocumentSequence;
use Illuminate\Support\Facades\DB;

/**
 * Crédits clients (M09) : anciennes dettes CR-N, annulation (avec le choix P3
 * si de l'argent a déjà été reçu), régularisations, échéanciers.
 */
final class CreditService
{
    public function __construct(private CreditLedger $ledger) {}

    /** Ancienne dette saisie sans vente, marquée « solde initial » (§7.6). */
    public function openingBalance(Shop $shop, User $user, array $in): CustomerCredit
    {
        $errors = [];
        $customer = Customer::query()->where('is_active', true)->find((int) ($in['customer_id'] ?? 0));
        if (! $customer) {
            $errors['customer_id'] = ['Choisissez un client.'];
        }
        $amount = D::parse($in['amount'] ?? null);
        if ($amount === null || D::cmp($amount, '0') <= 0) {
            $errors['amount'] = ['Saisissez le montant de la dette.'];
        }
        $at = filled($in['occurred_at'] ?? null) ? now()->parse($in['occurred_at']) : now();
        if ($at->isFuture()) {
            $errors['occurred_at'] = ['La date ne peut pas être dans le futur.'];
        }
        if ($errors) {
            throw new ApiException(422, 'Les informations saisies ne sont pas valides.', $errors);
        }

        return DB::transaction(function () use ($shop, $user, $customer, $amount, $at, $in) {
            $credit = CustomerCredit::create([
                'shop_id' => $shop->id,
                'customer_id' => $customer->id,
                'sale_id' => null,
                'reference' => DocumentSequence::reference('CR'),
                'occurred_at' => $at,
                'amount' => D::format($amount, D::MONEY),
                'remaining_amount' => D::format($amount, D::MONEY),
                'is_opening_balance' => true,
                'status' => 'open',
                'user_id' => $user->id,
                'note' => filled($in['note'] ?? null) ? trim($in['note']) : null,
            ]);
            Audit::record($user, 'credit.opening_balance', [
                'shop_id' => $shop->id, 'subject' => $credit, 'label' => $credit->reference, 'reason' => $credit->note,
                'new' => ['client' => $customer->name, 'montant' => (float) $amount],
            ]);

            return $credit;
        });
    }

    /** Un crédit de vente s'annule avec sa vente ; ici, un crédit sans vente (solde initial). */
    public function cancel(CustomerCredit $credit, User $user, ?string $reason, array $settlement): CustomerCredit
    {
        $reason = trim((string) $reason);
        if ($reason === '') {
            throw ApiException::invalid('reason', 'Indiquez pourquoi vous annulez ce crédit.');
        }

        return DB::transaction(function () use ($credit, $user, $reason, $settlement) {
            $credit = CustomerCredit::query()->lockForUpdate()->findOrFail($credit->id);
            if ($credit->status === 'cancelled') {
                throw ApiException::conflict('Ce crédit a déjà été annulé.');
            }
            if ($credit->sale_id) {
                throw ApiException::conflict('Ce crédit vient d’une vente : annulez la vente pour l’annuler.');
            }
            $repaid = $this->checkSettlement($credit, $settlement);
            $this->applySettlement($credit, $user, $settlement, $reason, $repaid);
            Audit::record($user, 'credit.cancelled', [
                'shop_id' => $credit->shop_id, 'subject' => $credit, 'label' => $credit->reference, 'reason' => $reason,
                'new' => ['argent_deja_recu' => D::cmp($repaid, '0') > 0
                    ? InstallmentSchedule::fr($repaid).' FCFA '.($settlement['refund_mode'] === 'credit_note' ? 'gardés en avoir' : 'rendus au client')
                    : null],
            ]);

            return $credit;
        });
    }

    /**
     * Décision P3 : l'argent déjà reçu sur un crédit annulé n'est jamais perdu. Le
     * commerçant choisit : avoir au nom du client, ou argent rendu. 422 si le choix manque.
     */
    public function checkSettlement(CustomerCredit $credit, array $settlement): string
    {
        $repaid = $this->ledger->repaid($credit->id);
        if (D::cmp($repaid, '0') <= 0) {
            return '0.00';
        }
        $errors = [];
        $mode = $settlement['refund_mode'] ?? null;
        if (! in_array($mode, ['credit_note', 'refund'], true)) {
            $errors['refund_mode'] = [sprintf('Ce client a déjà payé %s FCFA sur ce crédit : choisissez de les garder en avoir ou de les lui rendre.', InstallmentSchedule::fr($repaid))];
        }
        if ($mode === 'refund' && ! PaymentMethod::query()->where('is_active', true)->whereKey((int) ($settlement['refund_payment_method_id'] ?? 0))->exists()) {
            $errors['refund_payment_method_id'] = ["Choisissez comment l'argent est rendu."];
        }
        if ($errors) {
            throw new ApiException(422, 'Les informations saisies ne sont pas valides.', $errors);
        }

        return $repaid;
    }

    public function applySettlement(CustomerCredit $credit, User $user, array $settlement, string $reason, string $repaid): void
    {
        $paid = D::cmp($repaid, '0') > 0;
        if ($paid && $settlement['refund_mode'] === 'credit_note') {
            $this->ledger->addCreditNote($credit->shop_id, $credit->customer_id, $repaid, 'credit_cancel', $credit->id);
        }
        if ($paid && $settlement['refund_mode'] === 'refund') {
            CustomerRefund::create([
                'shop_id' => $credit->shop_id, 'customer_id' => $credit->customer_id, 'customer_credit_id' => $credit->id,
                'amount' => $repaid, 'payment_method_id' => (int) $settlement['refund_payment_method_id'], 'reason' => $reason, 'user_id' => $user->id,
            ]);
        }
        $credit->forceFill([
            'status' => 'cancelled', 'remaining_amount' => 0, 'cancelled_at' => now(), 'cancelled_by' => $user->id, 'cancel_reason' => $reason,
            'cancel_settlement_mode' => $paid ? $settlement['refund_mode'] : null,
            'cancel_settlement_amount' => $paid ? $repaid : null,
        ])->save();
    }

    /** Régularisation : positif = diminue le reste (geste commercial), négatif = l'augmente (erreur de saisie). */
    public function adjust(CustomerCredit $credit, User $user, mixed $amountInput, mixed $reasonInput): CustomerCredit
    {
        return DB::transaction(function () use ($credit, $user, $amountInput, $reasonInput) {
            $credit = $this->ledger->recompute(CustomerCredit::query()->lockForUpdate()->findOrFail($credit->id));
            if ($credit->status === 'cancelled') {
                throw ApiException::conflict('Ce crédit est annulé.');
            }
            $errors = [];
            $amount = D::parse($amountInput);
            if ($amount === null || D::cmp($amount, '0') === 0) {
                $errors['amount'][] = 'Saisissez un montant différent de 0.';
            }
            $reason = trim((string) $reasonInput);
            if ($reason === '') {
                $errors['reason'][] = 'Indiquez le motif de la régularisation.';
            }
            $before = (string) $credit->remaining_amount;
            if ($amount !== null && D::cmp($amount, '0') !== 0) {
                $after = D::sub($before, $amount, D::MONEY);
                if (D::cmp($after, '0') < 0) {
                    $errors['amount'][] = sprintf('Le reste ne peut pas devenir négatif : il est de %s FCFA.', InstallmentSchedule::fr($before));
                }
                if (D::cmp($after, D::sub((string) $credit->amount, $this->ledger->repaid($credit->id), D::MONEY)) > 0) {
                    $errors['amount'][] = 'Le reste ne peut pas dépasser le montant du crédit.';
                }
            }
            if ($errors) {
                throw new ApiException(422, 'Les informations saisies ne sont pas valides.', $errors);
            }
            CreditAdjustment::create(['customer_credit_id' => $credit->id, 'amount' => D::format($amount, D::MONEY), 'reason' => $reason, 'user_id' => $user->id]);
            $this->ledger->recompute($credit);
            Audit::record($user, 'credit.adjusted', [
                'shop_id' => $credit->shop_id, 'subject' => $credit, 'label' => $credit->reference, 'reason' => $reason,
                'old' => ['reste' => (float) $before], 'new' => ['reste' => (float) $credit->remaining_amount],
            ]);

            return $credit;
        });
    }

    /** Échéancier (§7.7) : le total doit égaler le reste ; les échéances déjà payées restent. */
    public function setInstallments(CustomerCredit $credit, array $items): CustomerCredit
    {
        return DB::transaction(function () use ($credit, $items) {
            $credit = $this->ledger->recompute(CustomerCredit::query()->lockForUpdate()->findOrFail($credit->id));
            if (in_array($credit->status, ['cancelled', 'settled'], true)) {
                throw ApiException::conflict('Ce crédit n’a plus de reste à payer.');
            }
            InstallmentSchedule::replace('customer_credit', $credit->id, (string) $credit->remaining_amount, $items);

            return $credit;
        });
    }
}
