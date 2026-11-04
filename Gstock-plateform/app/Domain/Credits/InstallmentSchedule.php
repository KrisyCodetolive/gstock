<?php

namespace App\Domain\Credits;

use App\Domain\Credits\Models\Installment;
use App\Support\ApiException;
use App\Support\Decimal as D;
use Illuminate\Support\Collection;

/**
 * Échéanciers (§7.7), communs aux crédits clients et aux dettes fournisseurs.
 * Les paiements soldent les échéances de la plus ancienne à la plus récente ;
 * une échéance dépassée et non soldée est « en retard ». L'état est calculé à la
 * lecture : aucune tâche planifiée n'est nécessaire pour le tenir à jour.
 */
final class InstallmentSchedule
{
    /** État de chaque échéance pour un reste dû. @return list<array{id: int, due_date: string, amount: string, paid_amount: string, status: string}> */
    public static function of(string $payableType, int $payableId, string $remaining): array
    {
        return self::compute(self::rows($payableType, $payableId), $remaining);
    }

    /** @param  Collection<int, Installment>  $rows */
    public static function compute(Collection $rows, string $remaining): array
    {
        $today = now()->toDateString();
        $items = $rows->sortBy(fn (Installment $i) => [$i->due_date->toDateString(), $i->id])->values();
        $active = $items->reject(fn (Installment $i) => $i->frozen);
        $sum = $active->reduce(fn ($s, Installment $i) => D::add($s, (string) $i->amount, D::MONEY), '0.00');
        $pool = D::sub($sum, $remaining, D::MONEY);
        if (D::cmp($pool, '0') < 0) {
            $pool = '0.00';
        }

        return $items->map(function (Installment $i) use (&$pool, $today) {
            $amount = D::format((string) $i->amount, D::MONEY);
            $paid = $amount;
            if (! $i->frozen) {
                $paid = D::min($pool, $amount);
                $pool = D::sub($pool, $paid, D::MONEY);
            }
            $due = $i->due_date->toDateString();
            $status = D::cmp($paid, $amount) >= 0 ? 'paid' : ($due < $today ? 'overdue' : (D::cmp($paid, '0') > 0 ? 'partial' : 'pending'));

            return ['id' => $i->id, 'due_date' => $due, 'amount' => $amount, 'paid_amount' => D::format($paid, D::MONEY), 'status' => $status];
        })->all();
    }

    /**
     * Nouvel échéancier : les échéances déjà soldées restent ; les nouvelles couvrent
     * exactement le reste dû. 422 en français sinon.
     *
     * @param  list<array{due_date?: mixed, amount?: mixed}>  $input
     */
    public static function replace(string $payableType, int $payableId, string $remaining, array $input): void
    {
        $parsed = array_map(fn ($i) => ['due_date' => (string) ($i['due_date'] ?? ''), 'amount' => D::format(D::parse($i['amount'] ?? null) ?? '0', D::MONEY)], $input);
        $errors = [];
        if (! $parsed) {
            $errors[] = 'Ajoutez au moins une échéance.';
        }
        if (array_filter($parsed, fn ($i) => ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $i['due_date']))) {
            $errors[] = 'Chaque échéance a besoin d’une date.';
        }
        if (array_filter($parsed, fn ($i) => D::cmp($i['amount'], '0') <= 0)) {
            $errors[] = 'Chaque échéance a besoin d’un montant supérieur à 0.';
        }
        $total = array_reduce($parsed, fn ($s, $i) => D::add($s, $i['amount'], D::MONEY), '0.00');
        if (D::cmp($total, $remaining) !== 0) {
            $errors[] = sprintf('Le total des échéances doit être égal au reste : %s FCFA (actuellement %s FCFA).', self::fr($remaining), self::fr($total));
        }
        if ($errors) {
            throw new ApiException(422, 'Les informations saisies ne sont pas valides.', ['installments' => $errors]);
        }

        $current = self::rows($payableType, $payableId);
        $frozen = collect(self::compute($current, $remaining))->filter(fn ($i) => D::cmp($i['paid_amount'], '0') > 0);
        Installment::query()->where('payable_type', $payableType)->where('payable_id', $payableId)->delete();
        foreach ($frozen as $i) {
            Installment::create(['payable_type' => $payableType, 'payable_id' => $payableId, 'due_date' => $i['due_date'], 'amount' => $i['paid_amount'], 'frozen' => true]);
        }
        foreach ($parsed as $i) {
            Installment::create(['payable_type' => $payableType, 'payable_id' => $payableId, 'due_date' => $i['due_date'], 'amount' => $i['amount'], 'frozen' => false]);
        }
    }

    /** @return Collection<int, Installment> */
    public static function rows(string $payableType, int $payableId): Collection
    {
        return Installment::query()->where('payable_type', $payableType)->where('payable_id', $payableId)->get();
    }

    /** « 10 000 » : montant lisible en français. */
    public static function fr(string $amount): string
    {
        return number_format((float) $amount, (float) $amount == floor((float) $amount) ? 0 : 2, ',', "\u{202F}");
    }
}
