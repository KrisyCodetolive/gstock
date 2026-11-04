<?php

namespace App\Domain\Credits;

use App\Domain\Audit\Audit;
use App\Domain\Credits\Models\CreditRepayment;
use App\Domain\Credits\Models\CustomerCredit;
use App\Domain\Customers\Models\Customer;
use App\Domain\Identity\Models\User;
use App\Domain\Sales\Models\PaymentMethod;
use App\Domain\Shops\Models\Shop;
use App\Domain\Shops\Models\TenantPaymentSetting;
use App\Support\ApiException;
use App\Support\Decimal as D;
use App\Support\DocumentSequence;
use Illuminate\Support\Facades\DB;

/**
 * Paiements de crédit RB-N (§7.6) : affectés du plus ancien au plus récent, ou
 * selon le choix du commerçant, jamais au-delà du montant reçu. Un paiement
 * GeniusPay reste en attente jusqu'au webhook et ne compte qu'une fois confirmé (ADR-003).
 */
final class RepaymentService
{
    public function __construct(private CreditLedger $ledger) {}

    public function record(Shop $shop, User $user, array $in): CreditRepayment
    {
        // Idempotence hors ligne : un second envoi renvoie le paiement déjà enregistré (ADR-005).
        if (filled($in['offline_uuid'] ?? null) && $existing = CreditRepayment::query()->where('offline_uuid', $in['offline_uuid'])->first()) {
            return $existing;
        }
        $customer = Customer::query()->find((int) ($in['customer_id'] ?? 0));
        if (! $customer) {
            throw ApiException::invalid('customer_id', 'Choisissez un client.');
        }

        return DB::transaction(function () use ($shop, $user, $in, $customer) {
            // Crédits verrouillés : deux paiements simultanés ne soldent pas deux fois la même dette.
            $credits = $this->ledger->openCredits($customer->id, $shop->id, lock: true);
            $due = $credits->reduce(fn ($s, CustomerCredit $c) => D::add($s, (string) $c->remaining_amount, D::MONEY), '0.00');
            $errors = [];
            $add = function (string $field, string $message) use (&$errors) {
                $errors[$field][] = $message;
            };

            $amount = D::format(D::parse($in['amount'] ?? null) ?? '0', D::MONEY);
            if (D::cmp($amount, '0') <= 0) {
                $add('amount', 'Saisissez le montant reçu.');
            } elseif (D::cmp($amount, $due) > 0) {
                $add('amount', D::cmp($due, '0') > 0
                    ? sprintf('Le client ne doit que %s FCFA dans cette boutique.', InstallmentSchedule::fr($due))
                    : 'Ce client ne doit rien dans cette boutique.');
            }
            $useNote = ($in['use_credit_note'] ?? false) === true;
            $method = $useNote ? null : PaymentMethod::query()->where('is_active', true)->find((int) ($in['payment_method_id'] ?? 0));
            if (! $useNote && ! $method) {
                $add('payment_method_id', 'Choisissez le mode de paiement.');
            }
            if ($useNote) {
                $note = $this->ledger->creditNoteBalance($customer->id, $shop->id);
                if (D::cmp($amount, $note) > 0) {
                    $add('amount', sprintf("L'avoir du client n'est que de %s FCFA.", InstallmentSchedule::fr($note)));
                }
            }

            $allocations = $this->ledger->autoAllocate($amount, $credits);
            if (! empty($in['allocations'])) {
                $allocations = [];
                foreach ((array) $in['allocations'] as $a) {
                    $part = D::format(D::parse($a['amount'] ?? null) ?? '0', D::MONEY);
                    if (D::cmp($part, '0') <= 0) {
                        continue;
                    }
                    $credit = $credits->firstWhere('id', (int) ($a['credit_id'] ?? 0));
                    if (! $credit) {
                        $add('allocations', 'Un des crédits choisis n’est plus ouvert.');
                    } elseif (D::cmp($part, (string) $credit->remaining_amount) > 0) {
                        $add('allocations', sprintf("Le crédit %s n'a plus que %s FCFA à payer.", $credit->reference, InstallmentSchedule::fr((string) $credit->remaining_amount)));
                    } else {
                        $allocations[] = ['credit' => $credit, 'amount' => $part];
                    }
                }
                // La somme affectée ne dépasse jamais le montant reçu, et tout le montant est affecté.
                $total = array_reduce($allocations, fn ($s, $a) => D::add($s, $a['amount'], D::MONEY), '0.00');
                if (D::cmp($total, $amount) !== 0) {
                    $add('allocations', sprintf('Répartissez exactement %s FCFA (actuellement %s FCFA).', InstallmentSchedule::fr($amount), InstallmentSchedule::fr($total)));
                }
            }
            if ($errors) {
                throw new ApiException(422, 'Les informations saisies ne sont pas valides.', $errors);
            }

            $pending = ! $useNote && $method->uses_geniuspay && (bool) TenantPaymentSetting::query()->value('is_active');
            $repayment = CreditRepayment::create([
                'shop_id' => $shop->id,
                'customer_id' => $customer->id,
                'reference' => DocumentSequence::reference('RB'),
                'offline_uuid' => $in['offline_uuid'] ?? null,
                'received_at' => filled($in['received_at'] ?? null) ? now()->parse($in['received_at']) : now(),
                'amount' => $amount,
                'payment_method_id' => $method?->id,
                'user_id' => $user->id,
                'note' => filled($in['note'] ?? null) ? trim($in['note']) : null,
                'status' => $pending ? 'pending' : 'completed',
            ]);
            foreach ($allocations as $a) {
                $repayment->allocations()->create(['customer_credit_id' => $a['credit']->id, 'amount' => $a['amount']]);
            }
            if ($useNote) {
                $this->ledger->addCreditNote($shop->id, $customer->id, D::neg($amount, D::MONEY), 'repayment', $repayment->id);
            }
            foreach ($allocations as $a) {
                $this->ledger->recompute($a['credit']);
            }

            return $repayment;
        });
    }

    /** Annuler un paiement libère ses affectations et recalcule les restes (§7.6). */
    public function cancel(CreditRepayment $repayment, User $user, ?string $reason): CreditRepayment
    {
        $reason = trim((string) $reason);
        if ($reason === '') {
            throw ApiException::invalid('reason', 'Indiquez pourquoi vous annulez ce paiement.');
        }

        return DB::transaction(function () use ($repayment, $user, $reason) {
            $repayment = CreditRepayment::query()->lockForUpdate()->findOrFail($repayment->id);
            if ($repayment->status === 'cancelled') {
                throw ApiException::conflict('Ce paiement a déjà été annulé.');
            }
            $credits = CustomerCredit::query()->whereIn('id', $repayment->allocations()->pluck('customer_credit_id'))->lockForUpdate()->get();
            if ($credits->contains(fn ($c) => $c->cancel_settlement_mode !== null)) {
                throw ApiException::conflict('Une partie de ce paiement a déjà été rendue au client ou gardée en avoir lors d’une annulation : il ne peut plus être annulé.');
            }
            $repayment->update(['status' => 'cancelled', 'cancelled_at' => now(), 'cancelled_by' => $user->id, 'cancel_reason' => $reason]);
            if ($repayment->payment_method_id === null) {
                $this->ledger->addCreditNote($repayment->shop_id, $repayment->customer_id, (string) $repayment->amount, 'repayment_cancel', $repayment->id);
            }
            $credits->each(fn ($c) => $this->ledger->recompute($c));
            Audit::record($user, 'repayment.cancelled', [
                'shop_id' => $repayment->shop_id, 'subject' => $repayment, 'label' => $repayment->reference, 'reason' => $reason,
                'old' => ['montant' => (float) $repayment->amount],
            ]);

            return $repayment;
        });
    }
}
