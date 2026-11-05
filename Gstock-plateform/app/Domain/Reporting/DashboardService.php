<?php

namespace App\Domain\Reporting;

use App\Domain\Credits\InstallmentSchedule;
use App\Domain\Identity\Models\User;
use App\Domain\Stock\AdjustmentService;
use App\Domain\Stock\Expiry;
use App\Http\Controllers\Api\V1\StockController;
use App\Support\Decimal as D;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Tableau de bord (M13), selon la distinction financière du §7.8 :
 * une vente à crédit est une vente mais pas un encaissement ; un remboursement
 * est un encaissement mais pas une vente. Les opérations annulées ne comptent pas.
 * Sans `records.view_all`, seules ses propres opérations sont comptées (§6.2) ;
 * le stock et les crédits sont l'état actuel des boutiques.
 */
final class DashboardService
{
    /** Fuseau des espaces (§7.10) : Africa/Abidjan, soit UTC. */
    public const TIMEZONE = 'Africa/Abidjan';

    private const DAYS = ['today' => 1, 'week' => 7, 'month' => 30];

    private User $user;

    /** @var list<int> */
    private array $shops;

    /** @param  list<int>  $shopIds */
    public function build(User $user, array $shopIds, string $period): array
    {
        $this->user = $user;
        $this->shops = $shopIds ?: [0];
        $period = isset(self::DAYS[$period]) ? $period : 'today';
        $days = self::DAYS[$period];
        // Période au fuseau de l'espace, et la même durée juste avant (hier pour « aujourd'hui »).
        $from = CarbonImmutable::now(self::TIMEZONE)->startOfDay()->subDays($days - 1)->utc();
        $to = CarbonImmutable::now()->utc();
        $prevFrom = $from->subDays($days);
        $prevTo = $from->subSecond();

        $sales = $this->own($this->table('sales'))->where('status', 'completed')->whereBetween('occurred_at', [$from, $to])
            ->selectRaw('count(*) as n, coalesce(sum(total), 0) as total, coalesce(sum(credit_amount), 0) as on_credit')->first();
        $previous = (string) $this->own($this->table('sales'))->where('status', 'completed')->whereBetween('occurred_at', [$prevFrom, $prevTo])->sum('total');

        // Payé immédiatement : paiements réels, hors avoir (un avoir n'est pas un encaissement).
        $salePayments = DB::table('sale_payments as sp')->join('sales as s', 's.id', '=', 'sp.sale_id')
            ->where('s.tenant_id', tenant('id'))->whereIn('s.shop_id', $this->shops)->where('s.status', 'completed')
            ->when(! $this->seesAll(), fn ($q) => $q->where('s.user_id', $this->user->id))
            ->whereBetween('s.occurred_at', [$from, $to])->where('sp.status', 'completed')->whereNotNull('sp.payment_method_id')
            ->groupBy('sp.payment_method_id')->selectRaw('sp.payment_method_id as method_id, sum(sp.amount) as amount')->get();
        // Remboursements reçus : encaissement mais pas vente (§7.8).
        $repayments = $this->own($this->table('credit_repayments'))->where('status', 'completed')->whereNotNull('payment_method_id')
            ->whereBetween('received_at', [$from, $to])->groupBy('payment_method_id')->selectRaw('payment_method_id as method_id, sum(amount) as amount')->get();
        $paidNow = $this->sum($salePayments);
        $fromRepayments = $this->sum($repayments);

        $expenses = (string) $this->own($this->table('expenses'))->where('status', 'completed')->whereBetween('occurred_at', [$from, $to])->sum('amount');
        $refunds = (string) $this->own($this->table('customer_refunds'))->whereBetween('created_at', [$from, $to])->sum('amount');
        $supplierPayments = (string) DB::table('purchase_payments as pp')->join('purchases as p', 'p.id', '=', 'pp.purchase_id')
            ->where('p.tenant_id', tenant('id'))->whereIn('p.shop_id', $this->shops)
            ->when(! $this->seesAll(), fn ($q) => $q->where('p.user_id', $this->user->id))
            ->where('pp.status', 'completed')->whereBetween('pp.paid_at', [$from, $to])->sum('pp.amount');

        // Coût d'achat des produits vendus (résultat estimé) ; incomplet si un prix d'achat manque.
        $cost = DB::table('sale_items as si')->join('sales as s', 's.id', '=', 'si.sale_id')
            ->where('s.tenant_id', tenant('id'))->whereIn('s.shop_id', $this->shops)->where('s.status', 'completed')
            ->when(! $this->seesAll(), fn ($q) => $q->where('s.user_id', $this->user->id))
            ->whereBetween('s.occurred_at', [$from, $to])
            ->selectRaw('coalesce(sum(si.unit_cost * si.base_quantity), 0) as cost, count(*) filter (where si.unit_cost is null) as missing')->first();
        $costOfGoods = D::round((string) $cost->cost, D::MONEY);

        $salesTotal = D::format((string) $sales->total, D::MONEY);
        $previousTotal = D::format($previous ?: '0', D::MONEY);

        return [
            'period' => ['key' => $period, 'from' => $from->toIso8601String(), 'to' => $to->toIso8601String()],
            'sales' => [
                'total' => $salesTotal,
                'count' => (int) $sales->n,
                'paid_now' => $paidNow,
                'on_credit' => D::format((string) $sales->on_credit, D::MONEY),
                'previous_total' => $previousTotal,
                'change_percent' => D::cmp($previousTotal, '0') > 0
                    ? (int) round(((float) $salesTotal - (float) $previousTotal) / (float) $previousTotal * 100)
                    : null,
            ],
            'money_in' => [
                'total' => D::add($paidNow, $fromRepayments, D::MONEY),
                'from_sales' => $paidNow,
                'from_repayments' => $fromRepayments,
                'by_method' => $this->byMethod($salePayments->concat($repayments)),
            ],
            'money_out' => [
                'expenses' => D::format($expenses ?: '0', D::MONEY),
                'customer_refunds' => D::format($refunds ?: '0', D::MONEY),
                'supplier_payments' => D::format($supplierPayments ?: '0', D::MONEY),
            ],
            'stock' => $this->stock(),
            'expiry' => $this->expiry(),
            // Pertes (§7.8) : ni dépense ni sortie d'argent, et non déduites du résultat estimé.
            'losses' => $this->losses($from, $to),
            // Transferts en route vers ces boutiques, à réceptionner (§7.12).
            'transfers' => ['to_receive' => DB::table('stock_transfers')->where('tenant_id', tenant('id'))->whereIn('to_shop_id', $this->shops)->where('status', 'in_transit')->count()],
            'credits' => $this->credits(),
            'result' => [
                'amount' => D::sub(D::sub($salesTotal, $costOfGoods, D::MONEY), D::format($expenses ?: '0', D::MONEY), D::MONEY),
                'cost_of_goods' => $costOfGoods,
                'complete' => (int) $cost->missing === 0,
            ],
            'installments' => $this->installments(),
            'recent' => $this->recent(),
        ];
    }

    /** Articles en alerte ou en rupture : produits actifs, variantes actives. */
    private function stock(): array
    {
        $row = DB::table('shop_stock')
            ->join('products', 'products.id', '=', 'shop_stock.product_id')
            ->leftJoin('product_variants', 'product_variants.id', '=', 'shop_stock.product_variant_id')
            ->where('shop_stock.tenant_id', tenant('id'))->whereIn('shop_stock.shop_id', $this->shops)
            ->where('products.is_active', true)->where('products.type', '!=', 'service')
            ->whereRaw("(products.type = 'variable') = (shop_stock.product_variant_id IS NOT NULL)")
            ->whereRaw('coalesce(product_variants.is_active, true)')
            ->selectRaw('count(*) filter (where '.StockController::STATE." = 'low') as low")
            ->selectRaw('count(*) filter (where '.StockController::STATE." = 'out') as out")
            ->first();

        return ['low' => (int) $row->low, 'out' => (int) $row->out];
    }

    /**
     * Péremption (§7.11) : articles qui ont des arrivages périmés ou bientôt périmés,
     * quantité et valeur au prix d'achat.
     */
    private function expiry(): array
    {
        $today = Expiry::today();
        $days = Expiry::tenantAlertDays();
        $row = DB::table('stock_lots as l')
            ->join('products', 'products.id', '=', 'l.product_id')
            ->leftJoin('product_variants', 'product_variants.id', '=', 'l.product_variant_id')
            ->where('l.tenant_id', tenant('id'))->whereIn('l.shop_id', $this->shops)
            ->where('l.quantity', '>', 0)->whereNotNull('l.expiry_date')
            ->where('products.is_active', true)->where('products.track_expiry', true)
            ->selectRaw('count(distinct (l.shop_id, l.product_id, coalesce(l.product_variant_id, 0))) filter (where l.expiry_date <= ?::date) as expired', [$today])
            ->selectRaw('coalesce(sum(l.quantity * coalesce(l.unit_cost, product_variants.cost, products.cost)) filter (where l.expiry_date <= ?::date), 0) as expired_value', [$today])
            ->selectRaw('count(distinct (l.shop_id, l.product_id, coalesce(l.product_variant_id, 0))) filter (where l.expiry_date > ?::date and l.expiry_date <= ?::date + coalesce(products.expiry_alert_days, ?)) as soon', [$today, $today, $days])
            ->selectRaw('coalesce(sum(l.quantity * coalesce(l.unit_cost, product_variants.cost, products.cost)) filter (where l.expiry_date > ?::date and l.expiry_date <= ?::date + coalesce(products.expiry_alert_days, ?)), 0) as soon_value', [$today, $today, $days])
            ->first();

        return [
            'expired' => (int) $row->expired,
            'expired_value' => D::format((string) $row->expired_value, D::MONEY),
            'soon' => (int) $row->soon,
            'soon_value' => D::format((string) $row->soon_value, D::MONEY),
        ];
    }

    /** Pertes de la période : sorties « périmé », « cassé », « volé » non annulées, au prix d'achat (§7.8). */
    private function losses(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $rows = DB::table('stock_movements as m')->join('adjustments as a', function ($j) {
            $j->on('a.id', '=', 'm.source_id')->where('m.source_type', '=', 'adjustment');
        })
            ->where('a.tenant_id', tenant('id'))->whereIn('a.shop_id', $this->shops)
            ->when(! $this->seesAll(), fn ($q) => $q->where('a.user_id', $this->user->id))
            ->where('a.kind', 'exit')->where('a.status', 'completed')->whereIn('a.exit_reason', AdjustmentService::LOSS_REASONS)
            ->whereBetween('a.occurred_at', [$from, $to])
            ->groupBy('a.exit_reason')
            ->selectRaw('a.exit_reason as reason, coalesce(sum(-m.quantity * m.unit_cost), 0) as amount, count(*) filter (where m.unit_cost is null) as missing')
            ->get()->keyBy('reason');
        // Manques constatés à la réception d'un transfert, comptés dans la boutique d'arrivée (§7.12).
        $transfer = DB::table('stock_transfer_items as i')->join('stock_transfers as t', 't.id', '=', 'i.stock_transfer_id')
            ->where('t.tenant_id', tenant('id'))->whereIn('t.to_shop_id', $this->shops)
            ->when(! $this->seesAll(), fn ($q) => $q->where('t.received_by', $this->user->id))
            ->where('t.status', 'received')->whereBetween('t.received_at', [$from, $to])
            ->selectRaw('coalesce(sum((i.quantity - i.received_quantity) * i.unit_cost), 0) as amount')
            ->selectRaw('count(*) filter (where i.unit_cost is null and i.received_quantity < i.quantity) as missing')->first();
        $by = [];
        $total = '0.00';
        foreach (AdjustmentService::LOSS_REASONS as $reason) {
            $amount = D::round((string) ($rows[$reason]->amount ?? '0'), D::MONEY);
            $by[$reason] = $amount;
            $total = D::add($total, $amount, D::MONEY);
        }
        $by['transfer'] = D::round((string) $transfer->amount, D::MONEY);
        $total = D::add($total, $by['transfer'], D::MONEY);

        return ['total' => $total, 'by_reason' => $by, 'complete' => $rows->sum('missing') == 0 && (int) $transfer->missing === 0];
    }

    /** Reste à récupérer : soldes des crédits ouverts des boutiques (§7.8). */
    private function credits(): array
    {
        $row = $this->table('customer_credits')->where('status', '!=', 'cancelled')->where('remaining_amount', '>', 0)
            ->selectRaw('coalesce(sum(remaining_amount), 0) as remaining, count(distinct customer_id) as debtors')->first();

        return ['remaining' => D::format((string) $row->remaining, D::MONEY), 'debtors' => (int) $row->debtors];
    }

    /** Échéances des crédits clients : en retard, et à venir dans les 7 jours (§7.7). */
    private function installments(): array
    {
        $credits = $this->table('customer_credits')->where('status', '!=', 'cancelled')->where('remaining_amount', '>', 0)
            ->whereIn('id', DB::table('installments')->where('tenant_id', tenant('id'))->where('payable_type', 'customer_credit')->select('payable_id'))
            ->get(['id', 'remaining_amount']);
        $week = CarbonImmutable::now(self::TIMEZONE)->addDays(7)->toDateString();
        $overdue = ['count' => 0, 'amount' => '0.00'];
        $upcoming = ['count' => 0, 'amount' => '0.00'];
        foreach ($credits as $c) {
            foreach (InstallmentSchedule::of('customer_credit', $c->id, (string) $c->remaining_amount) as $i) {
                $left = D::sub($i['amount'], $i['paid_amount'], D::MONEY);
                if ($i['status'] === 'overdue') {
                    $overdue = ['count' => $overdue['count'] + 1, 'amount' => D::add($overdue['amount'], $left, D::MONEY)];
                } elseif ($i['status'] !== 'paid' && $i['due_date'] <= $week) {
                    $upcoming = ['count' => $upcoming['count'] + 1, 'amount' => D::add($upcoming['amount'], $left, D::MONEY)];
                }
            }
        }

        return ['overdue' => $overdue, 'upcoming' => $upcoming];
    }

    /** Dix dernières opérations, toutes natures confondues ; chaque ligne ouvre son détail. */
    private function recent(): array
    {
        $take = fn (Builder $q) => $this->own($q)->orderByDesc('at')->orderByDesc('id')->limit(10)->get();
        $customers = fn (string $t) => "(select name from customers c where c.id = {$t}.customer_id)";
        $rows = collect()
            ->concat($take($this->table('sales')->selectRaw("id, reference, case when credit_amount > 0 then 'sale_credit' else 'sale' end as type, {$customers('sales')} as label, total as amount, occurred_at as at, status = 'cancelled' as cancelled, user_id, customer_id")))
            ->concat($take($this->table('credit_repayments')->selectRaw("id, reference, 'repayment' as type, {$customers('credit_repayments')} as label, amount, received_at as at, status = 'cancelled' as cancelled, user_id, customer_id")))
            ->concat($take($this->table('customer_credits')->where('is_opening_balance', true)->selectRaw("id, reference, 'opening_balance' as type, {$customers('customer_credits')} as label, amount, occurred_at as at, status = 'cancelled' as cancelled, user_id, customer_id")))
            ->concat($take($this->table('purchases')->selectRaw("id, reference, 'purchase' as type, (select name from suppliers x where x.id = purchases.supplier_id) as label, total as amount, occurred_at as at, status = 'cancelled' as cancelled, user_id, null as customer_id")))
            ->concat($take($this->table('expenses')->selectRaw("id, reference, 'expense' as type, (select name from expense_categories x where x.id = expenses.expense_category_id) as label, amount, occurred_at as at, status = 'cancelled' as cancelled, user_id, null as customer_id")))
            ->concat($take($this->table('adjustments')->selectRaw("id, reference, 'adjustment' as type, reason as label, null as amount, occurred_at as at, status = 'cancelled' as cancelled, user_id, null as customer_id")))
            // Transferts envoyés ou reçus par ces boutiques (§7.12) : « Cocody → Yopougon ».
            ->concat(DB::table('stock_transfers as t')->where('t.tenant_id', tenant('id'))
                ->where(fn ($q) => $q->whereIn('t.from_shop_id', $this->shops)->orWhereIn('t.to_shop_id', $this->shops))
                ->when(! $this->seesAll(), fn ($q) => $q->where(fn ($w) => $w->where('t.sent_by', $this->user->id)->orWhere('t.received_by', $this->user->id)))
                ->selectRaw("t.id, t.reference, 'transfer' as type, (select name from shops s where s.id = t.from_shop_id) || ' → ' || (select name from shops s where s.id = t.to_shop_id) as label, null as amount, t.sent_at as at, t.status = 'cancelled' as cancelled, t.sent_by as user_id, null as customer_id")
                ->orderByDesc('at')->orderByDesc('id')->limit(10)->get())
            ->sortByDesc(fn ($r) => CarbonImmutable::parse($r->at)->getTimestamp())->take(10)->values();
        $users = User::query()->whereIn('id', $rows->pluck('user_id')->unique())->get()->keyBy('id');

        return $rows->map(fn ($r) => [
            'type' => $r->type,
            'id' => (int) $r->id,
            'reference' => $r->reference,
            'label' => (string) ($r->label ?? ''),
            'amount' => $r->amount === null ? null : D::format((string) $r->amount, D::MONEY),
            'occurred_at' => CarbonImmutable::parse($r->at)->toIso8601String(),
            'cancelled' => (bool) $r->cancelled,
            'user' => isset($users[$r->user_id]) ? ['id' => (int) $r->user_id, 'name' => $users[$r->user_id]->name()] : null,
            'customer_id' => $r->customer_id === null ? null : (int) $r->customer_id,
        ])->all();
    }

    /** @param  Collection<int, object>  $rows */
    private function byMethod(Collection $rows): array
    {
        $totals = [];
        foreach ($rows as $r) {
            $totals[$r->method_id] = D::add($totals[$r->method_id] ?? '0', (string) $r->amount, D::MONEY);
        }
        $names = DB::table('payment_methods')->whereIn('id', array_keys($totals))->pluck('name', 'id');
        uasort($totals, fn ($a, $b) => D::cmp($b, $a));

        return collect($totals)->map(fn ($amount, $id) => ['method' => ['id' => (int) $id, 'name' => $names[$id] ?? '—'], 'amount' => $amount])->values()->all();
    }

    /** @param  Collection<int, object>  $rows */
    private function sum(Collection $rows): string
    {
        return $rows->reduce(fn ($s, $r) => D::add($s, (string) $r->amount, D::MONEY), '0.00');
    }

    private function table(string $name): Builder
    {
        return DB::table($name)->where("{$name}.tenant_id", tenant('id'))->whereIn("{$name}.shop_id", $this->shops);
    }

    private function own(Builder $q): Builder
    {
        return $q->when(! $this->seesAll(), fn ($q) => $q->where('user_id', $this->user->id));
    }

    private function seesAll(): bool
    {
        return $this->user->hasAnyPermission('records.view_all');
    }
}
