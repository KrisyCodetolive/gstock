<?php

namespace App\Domain\Expenses;

use App\Domain\Audit\Audit;
use App\Domain\Expenses\Models\Expense;
use App\Domain\Expenses\Models\ExpenseCategory;
use App\Domain\Identity\Models\User;
use App\Domain\Sales\Models\PaymentMethod;
use App\Domain\Shops\Models\Shop;
use App\Support\ApiException;
use App\Support\Decimal as D;
use App\Support\DocumentSequence;
use Illuminate\Support\Facades\DB;

/** Dépenses DP-N (M12) : faisables hors ligne (idempotentes), annulées avec un motif (ADR-012). */
final class ExpenseService
{
    public function record(Shop $shop, User $user, array $in): Expense
    {
        // Idempotence hors ligne : une dépense n'est jamais enregistrée deux fois (ADR-005).
        if (filled($in['offline_uuid'] ?? null) && $existing = Expense::query()->where('offline_uuid', $in['offline_uuid'])->first()) {
            return $existing;
        }
        $errors = [];
        if (! ExpenseCategory::query()->where('is_active', true)->whereKey((int) ($in['expense_category_id'] ?? 0))->exists()) {
            $errors['expense_category_id'] = ['Choisissez une catégorie.'];
        }
        $amount = D::parse($in['amount'] ?? null);
        if ($amount === null || D::cmp($amount, '0') <= 0) {
            $errors['amount'] = ['Saisissez le montant de la dépense.'];
        }
        if (! PaymentMethod::query()->where('is_active', true)->whereKey((int) ($in['payment_method_id'] ?? 0))->exists()) {
            $errors['payment_method_id'] = ['Choisissez le mode de paiement.'];
        }
        $at = filled($in['occurred_at'] ?? null) ? now()->parse($in['occurred_at']) : now();
        if ($at->isFuture()) {
            $errors['occurred_at'] = ['La date ne peut pas être dans le futur.'];
        }
        if ($errors) {
            throw new ApiException(422, 'Les informations saisies ne sont pas valides.', $errors);
        }

        return DB::transaction(fn () => Expense::create([
            'shop_id' => $shop->id,
            'reference' => DocumentSequence::reference('DP'),
            'offline_uuid' => $in['offline_uuid'] ?? null,
            'occurred_at' => $at,
            'expense_category_id' => (int) $in['expense_category_id'],
            'amount' => D::round($amount, D::MONEY),
            'payment_method_id' => (int) $in['payment_method_id'],
            'note' => filled($in['note'] ?? null) ? trim((string) $in['note']) : null,
            'user_id' => $user->id,
            'status' => 'completed',
        ]));
    }

    public function cancel(Expense $expense, User $user, ?string $reason): Expense
    {
        $reason = trim((string) $reason);
        if ($reason === '') {
            throw ApiException::invalid('reason', 'Indiquez pourquoi vous annulez cette dépense.');
        }

        return DB::transaction(function () use ($expense, $user, $reason) {
            $expense = Expense::query()->lockForUpdate()->findOrFail($expense->id);
            if ($expense->status === 'cancelled') {
                throw ApiException::conflict('Cette dépense a déjà été annulée.');
            }
            $expense->update(['status' => 'cancelled', 'cancelled_at' => now(), 'cancelled_by' => $user->id, 'cancel_reason' => $reason]);
            Audit::record($user, 'expense.cancelled', [
                'shop_id' => $expense->shop_id, 'subject' => $expense, 'label' => $expense->reference, 'reason' => $reason,
                'old' => ['montant' => (float) $expense->amount],
            ]);

            return $expense;
        });
    }
}
