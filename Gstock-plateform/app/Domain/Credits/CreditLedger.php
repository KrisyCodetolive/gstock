<?php

namespace App\Domain\Credits;

use App\Domain\Credits\Models\CreditNote;
use App\Domain\Credits\Models\CustomerCredit;
use App\Support\Decimal as D;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Règles de calcul des crédits (§7.6) : le reste n'est jamais saisi, il est
 * recalculé — montant − affectations des paiements confirmés − régularisations —
 * et l'état en découle (open, partial, settled). Avoirs (P3) : somme des mouvements.
 */
final class CreditLedger
{
    /** Σ des affectations de paiements confirmés (les paiements en attente ou annulés ne comptent pas). */
    public function repaid(int $creditId): string
    {
        return D::format((string) (DB::table('credit_repayment_allocations as a')
            ->join('credit_repayments as r', 'r.id', '=', 'a.credit_repayment_id')
            ->where('a.customer_credit_id', $creditId)->where('r.status', 'completed')
            ->sum('a.amount') ?: '0'), D::MONEY);
    }

    public function adjusted(int $creditId): string
    {
        return D::format((string) (DB::table('credit_adjustments')->where('customer_credit_id', $creditId)->sum('amount') ?: '0'), D::MONEY);
    }

    /** Recalcule et enregistre le reste et l'état d'un crédit. */
    public function recompute(CustomerCredit $credit): CustomerCredit
    {
        if ($credit->status === 'cancelled') {
            $credit->forceFill(['remaining_amount' => 0])->save();

            return $credit;
        }
        $paid = D::add($this->repaid($credit->id), $this->adjusted($credit->id), D::MONEY);
        $remaining = D::sub((string) $credit->amount, $paid, D::MONEY);
        if (D::cmp($remaining, '0') < 0) {
            $remaining = '0.00';
        }
        $status = D::cmp($remaining, '0') === 0 ? 'settled' : (D::cmp($paid, '0') > 0 ? 'partial' : 'open');
        $credit->forceFill(['remaining_amount' => $remaining, 'status' => $status])->save();

        return $credit;
    }

    /**
     * Crédits ouverts d'un client dans une boutique, du plus ancien au plus récent,
     * verrouillés jusqu'à la fin de la transaction (deux paiements simultanés ne
     * soldent pas deux fois la même dette).
     *
     * @return Collection<int, CustomerCredit>
     */
    public function openCredits(int $customerId, int $shopId, bool $lock = false): Collection
    {
        return CustomerCredit::query()->where('customer_id', $customerId)->where('shop_id', $shopId)
            ->where('status', '!=', 'cancelled')->where('remaining_amount', '>', 0)
            ->orderBy('occurred_at')->orderBy('id')
            ->when($lock, fn ($q) => $q->lockForUpdate())->get();
    }

    /** Affectation par défaut : du plus ancien au plus récent (§7.6). @return list<array{credit: CustomerCredit, amount: string}> */
    public function autoAllocate(string $amount, Collection $credits): array
    {
        $left = $amount;
        $out = [];
        foreach ($credits as $credit) {
            if (D::cmp($left, '0') <= 0) {
                break;
            }
            $part = D::min($left, (string) $credit->remaining_amount);
            if (D::cmp($part, '0') > 0) {
                $out[] = ['credit' => $credit, 'amount' => D::format($part, D::MONEY)];
            }
            $left = D::sub($left, $part, D::MONEY);
        }

        return $out;
    }

    /** Avoir d'un client : somme que la boutique lui doit (P3), dans une boutique ou un ensemble de boutiques. */
    public function creditNoteBalance(int $customerId, int|array|null $shopIds = null): string
    {
        $q = CreditNote::query()->where('customer_id', $customerId);
        if ($shopIds !== null) {
            $q->whereIn('shop_id', (array) $shopIds);
        }

        return D::format((string) ($q->sum('amount') ?: '0'), D::MONEY);
    }

    /** Avoirs de plusieurs clients dans des boutiques, en une requête. @return Collection<int, string> */
    public function creditNoteBalances(array $customerIds, array $shopIds): Collection
    {
        return CreditNote::query()->whereIn('customer_id', $customerIds)->whereIn('shop_id', $shopIds)
            ->groupBy('customer_id')->selectRaw('customer_id, sum(amount) as balance')->pluck('balance', 'customer_id');
    }

    public function addCreditNote(int $shopId, int $customerId, string $amount, string $source, int $sourceId): void
    {
        CreditNote::create(['shop_id' => $shopId, 'customer_id' => $customerId, 'amount' => $amount, 'source' => $source, 'source_id' => $sourceId]);
    }
}
