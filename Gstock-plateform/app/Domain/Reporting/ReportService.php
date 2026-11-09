<?php

namespace App\Domain\Reporting;

use App\Domain\Catalog\Models\Product;
use App\Domain\Credits\InstallmentSchedule;
use App\Domain\Purchases\SupplierCatalog;
use App\Support\ApiException;
use App\Support\Decimal as D;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Rapports, première partie (M15) : ventes jour par jour, ventes et marge par produit,
 * prix sous le prix d'achat, à racheter bientôt, produits dormants. Calcul SQL à la demande,
 * sur toutes les opérations validées des boutiques demandées (ADR-012), quel que soit l'auteur.
 */
final class ReportService
{
    /** Vitesse de vente : quantité vendue sur cette durée (jours), indépendante de la période choisie. */
    public const VELOCITY_DAYS = 30;

    /** « À racheter bientôt » : articles dont le stock tient ce nombre de jours ou moins. */
    public const RESTOCK_HORIZON = 14;

    public const DORMANT_CHOICES = [30, 60, 90];

    /** Clients qui ne reviennent plus : choix possibles, et nombre d'achats pour être un habitué. */
    public const LOST_CHOICES = [30, 60, 90];

    public const LOST_MIN_VISITS = 3;

    /** Une dette plus vieille que cela (jours) est en retard, même sans échéancier. */
    public const LATE_DEBT_DAYS = 60;

    /** Longueur des listes « payeurs ». */
    private const MAX_LIST = 20;

    private const MAX_DAYS = 366;

    private const MAX_ROWS = 500;

    /** @var list<int> */
    private array $shops;

    /**
     * Période du … au … (Y-m-d, fuseau de l'espace) : les 30 derniers jours par défaut,
     * 366 jours au plus, jamais dans le futur.
     *
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}
     */
    public static function period(?string $from, ?string $to): array
    {
        $tz = DashboardService::TIMEZONE;
        $parse = function (?string $value, string $field) use ($tz): ?CarbonImmutable {
            if (blank($value)) {
                return null;
            }
            $date = CarbonImmutable::createFromFormat('!Y-m-d', (string) $value, $tz);
            if (! $date || $date->format('Y-m-d') !== $value) {
                throw ApiException::invalid($field, 'Cette date n’est pas valide.');
            }

            return $date;
        };
        $today = CarbonImmutable::now($tz)->startOfDay();
        $end = $parse($to, 'to') ?? $today;
        $start = $parse($from, 'from') ?? $end->subDays(29);
        if ($end->greaterThan($today)) {
            throw ApiException::invalid('to', 'La période ne peut pas finir dans le futur.');
        }
        if ($start->greaterThan($end)) {
            throw ApiException::invalid('from', 'La date de début doit précéder la date de fin.');
        }
        if ($start->diffInDays($end) + 1 > self::MAX_DAYS) {
            throw ApiException::invalid('from', 'Choisissez une période d’un an au plus.');
        }

        return [$start, $end];
    }

    /** @param  list<int>  $shopIds */
    public function sales(array $shopIds, CarbonImmutable $start, CarbonImmutable $end): array
    {
        $this->shops = $shopIds ?: [0];
        [$from, $to] = $this->bounds($start, $end);
        $days = (int) $start->diffInDays($end) + 1;

        $totals = $this->completedSales()->whereBetween('occurred_at', [$from, $to])
            ->selectRaw('count(*) as n, coalesce(sum(total), 0) as total')->first();
        $items = DB::table('sale_items as si')->joinSub($this->completedSales()->whereBetween('occurred_at', [$from, $to])->select('id'), 's', 's.id', '=', 'si.sale_id')
            ->selectRaw('coalesce(sum(si.quantity), 0) as quantity, coalesce(sum(si.unit_cost * si.base_quantity), 0) as cost, count(*) filter (where si.unit_cost is null) as missing')->first();
        [$prevFrom, $prevTo] = $this->bounds($start->subDays($days), $start->subDay());
        $previous = (string) $this->completedSales()->whereBetween('occurred_at', [$prevFrom, $prevTo])->sum('total');

        // Fuseau de l'espace (Africa/Abidjan) = UTC : la date enregistrée est le jour du commerçant.
        $byDay = $this->completedSales()->whereBetween('occurred_at', [$from, $to])
            ->groupByRaw('occurred_at::date')->selectRaw('occurred_at::date as day, count(*) as n, sum(total) as total')
            ->get()->keyBy(fn ($r) => (string) $r->day);
        $series = [];
        for ($d = $start; $d->lessThanOrEqualTo($end); $d = $d->addDay()) {
            $row = $byDay[$d->format('Y-m-d')] ?? null;
            $series[] = ['date' => $d->format('Y-m-d'), 'total' => D::format($row ? (string) $row->total : '0', D::MONEY), 'count' => $row ? (int) $row->n : 0];
        }
        $ranked = collect($series)->sortBy([fn ($a, $b) => D::cmp($b['total'], $a['total']), fn ($a, $b) => strcmp($a['date'], $b['date'])])->values();

        $count = (int) $totals->n;
        $total = D::format((string) $totals->total, D::MONEY);
        $cost = D::round((string) $items->cost, D::MONEY);
        $previousTotal = D::format($previous ?: '0', D::MONEY);

        return [
            'period' => $this->periodOut($start, $end),
            'total' => $total,
            'count' => $count,
            'average_ticket' => $count > 0 ? D::div($total, (string) $count, D::MONEY) : '0.00',
            'items_per_sale' => $count > 0 ? D::div((string) $items->quantity, (string) $count, 1) : '0.0',
            'cost_of_goods' => $cost,
            'margin' => D::sub($total, $cost, D::MONEY),
            'margin_complete' => (int) $items->missing === 0,
            'previous_total' => $previousTotal,
            'change_percent' => D::cmp($previousTotal, '0') > 0
                ? round(((float) $total - (float) $previousTotal) / (float) $previousTotal * 100, 1)
                : null,
            'days' => $series,
            'best_day' => $count > 0 ? $ranked->first() : null,
            'worst_day' => $count > 0 ? $ranked->last() : null,
        ];
    }

    /** @param  list<int>  $shopIds */
    public function products(array $shopIds, CarbonImmutable $start, CarbonImmutable $end, int $dormantDays): array
    {
        $this->shops = $shopIds ?: [0];
        if (! in_array($dormantDays, self::DORMANT_CHOICES, true)) {
            throw ApiException::invalid('dormant_days', 'Choisissez 30, 60 ou 90 jours.');
        }
        [$from, $to] = $this->bounds($start, $end);

        // Chiffre d'un produit : sous-total de ses lignes au prorata du total de la vente (remise globale et taxe comprises).
        $sold = DB::table('sale_items as si')
            ->joinSub($this->completedSales()->whereBetween('occurred_at', [$from, $to])->select('id', 'total', 'subtotal'), 's', 's.id', '=', 'si.sale_id')
            ->groupBy('si.product_id', 'si.product_variant_id')
            ->selectRaw('si.product_id, si.product_variant_id, sum(si.base_quantity) as quantity, count(distinct si.sale_id) as sales')
            ->selectRaw('sum(case when s.subtotal > 0 then si.subtotal * s.total / s.subtotal else 0 end) as revenue')
            ->selectRaw('sum(si.unit_cost * si.base_quantity) as cost, count(*) filter (where si.unit_cost is null) as missing')
            ->orderByDesc('revenue')->limit(self::MAX_ROWS)->get();

        $restock = $this->restock();
        // Fournisseur habituel : le dernier chez qui l'article a été acheté (M11).
        $usual = app(SupplierCatalog::class)->lastSuppliers($this->shops);
        $dormant = $this->dormant($dormantDays);
        $belowCost = $this->belowCost();
        $refs = $this->articles(collect([$sold, $restock, $dormant['rows'], $belowCost])->flatten(1));

        return [
            'period' => $this->periodOut($start, $end),
            'sold' => $sold->map(function ($r) use ($refs) {
                $revenue = D::round((string) $r->revenue, D::MONEY);
                $complete = (int) $r->missing === 0;
                $cost = D::round((string) ($r->cost ?? '0'), D::MONEY);

                return [
                    ...$this->ref($refs, $r),
                    'quantity' => D::format((string) $r->quantity),
                    'sales' => (int) $r->sales,
                    'revenue' => $revenue,
                    // Sans prix d'achat sur une ligne, la marge n'est pas connue.
                    'cost' => $complete ? $cost : null,
                    'margin' => $complete ? D::sub($revenue, $cost, D::MONEY) : null,
                ];
            })->values()->all(),
            'below_cost' => $belowCost->map(fn ($r) => [
                ...$this->ref($refs, $r),
                'price' => D::format((string) $r->price, D::MONEY),
                'cost' => D::format((string) $r->cost, D::MONEY),
            ])->values()->all(),
            'restock' => [
                'velocity_days' => self::VELOCITY_DAYS,
                'horizon_days' => self::RESTOCK_HORIZON,
                'items' => $restock->map(function ($r) use ($refs, $usual) {
                    $perDay = D::div((string) $r->sold, (string) self::VELOCITY_DAYS, 3);
                    $daysLeft = (float) $r->quantity <= 0 ? 0 : (int) floor((float) $r->quantity / ((float) $r->sold / self::VELOCITY_DAYS));

                    return [
                        ...$this->ref($refs, $r),
                        'supplier' => $usual[$r->product_id.':'.($r->product_variant_id ?? '')] ?? null,
                        'quantity' => D::format((string) $r->quantity),
                        'sold_last_days' => D::format((string) $r->sold),
                        'per_day' => $perDay,
                        'days_left' => $daysLeft,
                        'suggested_quantity' => (string) max(0, (int) ceil((float) $r->sold - (float) $r->quantity)),
                    ];
                })->sortBy([['days_left', 'asc'], ['name', 'asc']])->values()->all(),
            ],
            'dormant' => [
                'days' => $dormantDays,
                'count' => $dormant['count'],
                'value' => $dormant['value'],
                'items' => $dormant['rows']->map(fn ($r) => [
                    ...$this->ref($refs, $r),
                    'quantity' => D::format((string) $r->quantity),
                    'value' => $r->value === null ? null : D::round((string) $r->value, D::MONEY),
                    'last_sold_at' => $r->last_sold === null ? null : CarbonImmutable::parse($r->last_sold)->toIso8601String(),
                ])->values()->all(),
            ],
        ];
    }

    /** @param  list<int>  $shopIds */
    public function customers(array $shopIds, CarbonImmutable $start, CarbonImmutable $end, int $lostDays): array
    {
        $this->shops = $shopIds ?: [0];
        if (! in_array($lostDays, self::LOST_CHOICES, true)) {
            throw ApiException::invalid('lost_days', 'Choisissez 30, 60 ou 90 jours.');
        }
        [$from, $to] = $this->bounds($start, $end);
        $inPeriod = fn () => $this->completedSales()->whereBetween('occurred_at', [$from, $to]);

        // Meilleurs clients : montant, visites, marge (prix d'achat des lignes de leurs ventes).
        $costs = DB::table('sale_items as si')->joinSub($inPeriod()->whereNotNull('customer_id')->select('id', 'customer_id'), 's', 's.id', '=', 'si.sale_id')
            ->groupBy('s.customer_id')->selectRaw('s.customer_id, sum(si.unit_cost * si.base_quantity) as cost, count(*) filter (where si.unit_cost is null) as missing');
        $top = $inPeriod()->whereNotNull('sales.customer_id')
            ->leftJoinSub($costs, 'c', 'c.customer_id', '=', 'sales.customer_id')
            ->groupBy('sales.customer_id', 'c.cost', 'c.missing')
            ->selectRaw('sales.customer_id, count(*) as visits, sum(sales.total) as revenue, max(sales.occurred_at) as last_at, c.cost, c.missing')
            ->orderByDesc('revenue')->limit(self::MAX_ROWS)->get();

        // Ventes à des clients connus et anonymes ; nouveaux clients (premier achat dans la période).
        $split = $inPeriod()->selectRaw('count(*) filter (where customer_id is not null) as known_n, coalesce(sum(total) filter (where customer_id is not null), 0) as known_total')
            ->selectRaw('count(*) filter (where customer_id is null) as anonymous_n, coalesce(sum(total) filter (where customer_id is null), 0) as anonymous_total')->first();
        $firsts = $this->completedSales()->whereNotNull('customer_id')->groupBy('customer_id')->selectRaw('customer_id, min(occurred_at) as first_at');
        $newCount = DB::query()->fromSub($firsts, 'f')->whereBetween('first_at', [$from, $to])->count();

        // Clients qui ne reviennent plus : au moins LOST_MIN_VISITS achats, aucun depuis $lostDays jours.
        $cutoff = CarbonImmutable::now(DashboardService::TIMEZONE)->startOfDay()->subDays($lostDays)->utc();
        $lostQuery = $this->completedSales()->whereNotNull('customer_id')->groupBy('customer_id')
            ->selectRaw('customer_id, count(*) as visits, sum(total) as revenue, max(occurred_at) as last_at')
            ->havingRaw('count(*) >= ?', [self::LOST_MIN_VISITS])->havingRaw('max(occurred_at) < ?', [$cutoff]);
        $lostCount = DB::query()->fromSub($lostQuery, 'l')->count();
        $lost = (clone $lostQuery)->orderByDesc('revenue')->limit(self::MAX_ROWS)->get();

        $debts = $this->debts();
        $recovery = $this->recovery($from, $to);
        $names = DB::table('customers')->where('tenant_id', tenant('id'))
            ->whereIn('id', collect([$top, $lost, $debts['rows'], $recovery['payers']])->flatten(1)->pluck('customer_id')->unique()->values())
            ->get(['id', 'name', 'phone'])->keyBy('id');
        $who = fn ($id) => ['id' => (int) $id, 'name' => (string) ($names[$id]->name ?? ''), 'phone' => $names[$id]->phone ?? null];
        $at = fn ($v) => $v === null ? null : CarbonImmutable::parse($v)->toIso8601String();

        return [
            'period' => $this->periodOut($start, $end),
            'top' => $top->map(function ($r) use ($who, $at) {
                $revenue = D::round((string) $r->revenue, D::MONEY);
                $complete = (int) ($r->missing ?? 0) === 0;

                return [
                    'customer' => $who($r->customer_id),
                    'visits' => (int) $r->visits,
                    'revenue' => $revenue,
                    'average_basket' => D::div($revenue, (string) $r->visits, D::MONEY),
                    'margin' => $complete ? D::sub($revenue, D::round((string) ($r->cost ?? '0'), D::MONEY), D::MONEY) : null,
                    'last_at' => $at($r->last_at),
                ];
            })->values()->all(),
            'known_sales' => ['count' => (int) $split->known_n, 'total' => D::format((string) $split->known_total, D::MONEY)],
            'anonymous_sales' => ['count' => (int) $split->anonymous_n, 'total' => D::format((string) $split->anonymous_total, D::MONEY)],
            'new_customers' => $newCount,
            'lost' => [
                'days' => $lostDays,
                'min_visits' => self::LOST_MIN_VISITS,
                'count' => $lostCount,
                'items' => $lost->map(fn ($r) => [
                    'customer' => $who($r->customer_id),
                    'visits' => (int) $r->visits,
                    'revenue' => D::round((string) $r->revenue, D::MONEY),
                    'last_at' => $at($r->last_at),
                ])->values()->all(),
            ],
            'debt_aging' => [
                'total' => $debts['total'],
                'buckets' => $debts['buckets'],
                'top' => $debts['rows']->sortByDesc(fn ($r) => (float) $r->remaining)->take(10)->map(fn ($r) => [
                    'customer' => $who($r->customer_id),
                    'remaining' => D::round((string) $r->remaining, D::MONEY),
                    'oldest_at' => $at($r->oldest_at),
                    'overdue' => $r->overdue,
                ])->values()->all(),
            ],
            'recovery' => $recovery['summary'],
            'payers' => [
                'late_days' => self::LATE_DEBT_DAYS,
                'late' => $debts['rows']->filter(fn ($r) => $r->late)->sortByDesc(fn ($r) => (float) $r->remaining)->take(self::MAX_LIST)->map(fn ($r) => [
                    'customer' => $who($r->customer_id),
                    'remaining' => D::round((string) $r->remaining, D::MONEY),
                    'overdue' => $r->overdue,
                    'oldest_at' => $at($r->oldest_at),
                ])->values()->all(),
                'good' => $recovery['payers']->reject(fn ($r) => $debts['rows']->firstWhere('customer_id', $r->customer_id)?->late)
                    ->take(self::MAX_LIST)->map(fn ($r) => [
                        'customer' => $who($r->customer_id),
                        'paid' => D::round((string) $r->paid, D::MONEY),
                        'payments' => (int) $r->n,
                    ])->values()->all(),
            ],
        ];
    }

    /**
     * Crédits en cours (reste à payer > 0) : âge, échéances dépassées, retard (§7.7).
     *
     * @return array{total: string, buckets: list<array{key: string, amount: string, count: int}>, rows: Collection}
     */
    private function debts(): array
    {
        $today = CarbonImmutable::now(DashboardService::TIMEZONE)->startOfDay();
        $open = DB::table('customer_credits')->where('tenant_id', tenant('id'))->whereIn('shop_id', $this->shops)
            ->where('status', '!=', 'cancelled')->where('remaining_amount', '>', 0)
            ->get(['id', 'customer_id', 'occurred_at', 'remaining_amount']);
        $buckets = ['under_30' => ['0.00', 0], '30_60' => ['0.00', 0], 'over_60' => ['0.00', 0]];
        $perCustomer = [];
        foreach ($open as $c) {
            $age = (int) CarbonImmutable::parse($c->occurred_at)->startOfDay()->diffInDays($today);
            $key = $age < 30 ? 'under_30' : ($age <= 60 ? '30_60' : 'over_60');
            $buckets[$key] = [D::add($buckets[$key][0], (string) $c->remaining_amount, D::MONEY), $buckets[$key][1] + 1];
            $overdue = collect(InstallmentSchedule::of('customer_credit', (int) $c->id, (string) $c->remaining_amount))
                ->where('status', 'overdue')->reduce(fn ($s, $i) => D::add($s, D::sub($i['amount'], $i['paid_amount'], D::MONEY), D::MONEY), '0.00');
            $row = $perCustomer[$c->customer_id] ?? (object) ['customer_id' => $c->customer_id, 'remaining' => '0.00', 'overdue' => '0.00', 'oldest_at' => $c->occurred_at, 'late' => false];
            $row->remaining = D::add($row->remaining, (string) $c->remaining_amount, D::MONEY);
            $row->overdue = D::add($row->overdue, $overdue, D::MONEY);
            $row->oldest_at = min($row->oldest_at, $c->occurred_at);
            // En retard : une échéance dépassée, ou une dette plus vieille que LATE_DEBT_DAYS.
            $row->late = $row->late || D::cmp($overdue, '0') > 0 || $age > self::LATE_DEBT_DAYS;
            $perCustomer[$c->customer_id] = $row;
        }

        return [
            'total' => D::format((string) $open->sum('remaining_amount'), D::MONEY),
            'buckets' => collect($buckets)->map(fn ($b, $key) => ['key' => $key, 'amount' => $b[0], 'count' => $b[1]])->values()->all(),
            'rows' => collect(array_values($perCustomer)),
        ];
    }

    /**
     * Recouvrement de la période : mis à crédit (hors anciennes dettes) et argent reçu sur des crédits
     * (paiements confirmés, hors avoir, §7.8) ; qui a payé, du plus gros paiement au plus petit.
     *
     * @return array{summary: array, payers: Collection}
     */
    private function recovery(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $credited = (string) DB::table('customer_credits')->where('tenant_id', tenant('id'))->whereIn('shop_id', $this->shops)
            ->where('status', '!=', 'cancelled')->where('is_opening_balance', false)->whereBetween('occurred_at', [$from, $to])->sum('amount');
        $repayments = DB::table('credit_repayments')->where('tenant_id', tenant('id'))->whereIn('shop_id', $this->shops)
            ->where('status', 'completed')->whereNotNull('payment_method_id')->whereBetween('received_at', [$from, $to]);
        $repaid = (string) (clone $repayments)->sum('amount');
        $credited = D::format($credited ?: '0', D::MONEY);
        $repaid = D::format($repaid ?: '0', D::MONEY);

        return [
            'summary' => [
                'credited' => $credited,
                'repaid' => $repaid,
                'rate' => D::cmp($credited, '0') > 0 ? round((float) $repaid / (float) $credited * 100, 1) : null,
            ],
            'payers' => (clone $repayments)->groupBy('customer_id')->selectRaw('customer_id, sum(amount) as paid, count(*) as n')
                ->orderByDesc('paid')->limit(self::MAX_ROWS)->get(),
        ];
    }

    /** Articles qui se vendent et dont le stock tient RESTOCK_HORIZON jours ou moins (toutes boutiques demandées réunies). */
    private function restock(): Collection
    {
        $since = CarbonImmutable::now(DashboardService::TIMEZONE)->startOfDay()->subDays(self::VELOCITY_DAYS)->utc();
        $sold = DB::table('sale_items as si')
            ->joinSub($this->completedSales()->where('occurred_at', '>=', $since)->select('id'), 's', 's.id', '=', 'si.sale_id')
            ->groupBy('si.product_id', 'si.product_variant_id')
            ->selectRaw('si.product_id, si.product_variant_id, sum(si.base_quantity) as sold');

        return $this->stockRows()
            ->joinSub($sold, 'v', fn ($j) => $j->on('v.product_id', '=', 'ss.product_id')->whereRaw('v.product_variant_id IS NOT DISTINCT FROM ss.product_variant_id'))
            ->groupBy('ss.product_id', 'ss.product_variant_id', 'v.sold')
            ->selectRaw('ss.product_id, ss.product_variant_id, sum(ss.quantity) as quantity, v.sold')
            ->havingRaw('v.sold > 0 AND sum(ss.quantity) * ? <= v.sold * ?', [self::VELOCITY_DAYS, self::RESTOCK_HORIZON])
            ->limit(self::MAX_ROWS)->get();
    }

    /**
     * Articles en stock sans vente depuis $days jours ; un produit créé depuis n'est pas dormant.
     *
     * @return array{rows: Collection, count: int, value: string}
     */
    private function dormant(int $days): array
    {
        $cutoff = CarbonImmutable::now(DashboardService::TIMEZONE)->startOfDay()->subDays($days)->utc();
        $last = DB::table('sale_items as si')
            ->joinSub($this->completedSales()->select('id', 'occurred_at'), 's', 's.id', '=', 'si.sale_id')
            ->groupBy('si.product_id', 'si.product_variant_id')
            ->selectRaw('si.product_id, si.product_variant_id, max(s.occurred_at) as last_sold');

        $query = $this->stockRows()
            ->leftJoinSub($last, 'ls', fn ($j) => $j->on('ls.product_id', '=', 'ss.product_id')->whereRaw('ls.product_variant_id IS NOT DISTINCT FROM ss.product_variant_id'))
            ->leftJoin('product_variants as pv', 'pv.id', '=', 'ss.product_variant_id')
            ->groupBy('ss.product_id', 'ss.product_variant_id', 'ls.last_sold', 'p.created_at', 'pv.cost', 'p.cost')
            ->selectRaw('ss.product_id, ss.product_variant_id, sum(ss.quantity) as quantity, ls.last_sold')
            ->selectRaw('sum(ss.quantity) * coalesce(pv.cost, p.cost) as value')
            ->havingRaw('sum(ss.quantity) > 0')
            ->havingRaw('coalesce(ls.last_sold, p.created_at) < ?', [$cutoff]);

        $all = DB::query()->fromSub($query, 'd')->selectRaw('count(*) as n, coalesce(sum(value), 0) as value')->first();

        return [
            'rows' => (clone $query)->orderByRaw('value DESC NULLS LAST')->limit(self::MAX_ROWS)->get(),
            'count' => (int) $all->n,
            'value' => D::round((string) $all->value, D::MONEY),
        ];
    }

    /** Produits simples et variantes actifs dont le prix de vente actuel est sous le prix d'achat. */
    private function belowCost(): Collection
    {
        $simple = DB::table('products as p')->where('p.tenant_id', tenant('id'))->where('p.is_active', true)->where('p.type', 'simple')
            ->whereNotNull('p.cost')->whereColumn('p.price', '<', 'p.cost')
            ->selectRaw('p.id as product_id, null::bigint as product_variant_id, p.price, p.cost');
        $variants = DB::table('product_variants as pv')->join('products as p', 'p.id', '=', 'pv.product_id')
            ->where('p.tenant_id', tenant('id'))->where('p.is_active', true)->where('pv.is_active', true)
            ->whereNotNull('pv.cost')->whereColumn('pv.price', '<', 'pv.cost')
            ->selectRaw('p.id as product_id, pv.id as product_variant_id, pv.price, pv.cost');

        return $simple->unionAll($variants)->limit(self::MAX_ROWS)->get();
    }

    /** Lignes de stock des boutiques demandées, produits actifs stockables. */
    private function stockRows(): Builder
    {
        return DB::table('shop_stock as ss')->join('products as p', 'p.id', '=', 'ss.product_id')
            ->where('ss.tenant_id', tenant('id'))->whereIn('ss.shop_id', $this->shops)
            ->where('p.is_active', true)->where('p.type', '!=', 'service');
    }

    /** Ventes validées des boutiques demandées (les annulées ne comptent pas, ADR-012). */
    private function completedSales(): Builder
    {
        return DB::table('sales')->where('sales.tenant_id', tenant('id'))->whereIn('sales.shop_id', $this->shops)->where('sales.status', 'completed');
    }

    /**
     * Nom, unité, catégorie et photo de chaque article cité.
     *
     * @return array<int, Product>
     */
    private function articles(Collection $rows): array
    {
        $ids = $rows->pluck('product_id')->unique()->values()->all();

        return Product::query()->with(['unit', 'category', 'variants'])->whereIn('id', $ids)->get()->keyBy('id')->all();
    }

    /** @param  array<int, Product>  $refs */
    private function ref(array $refs, object $row): array
    {
        $p = $refs[(int) $row->product_id] ?? null;
        $variant = $row->product_variant_id ? $p?->variants->firstWhere('id', (int) $row->product_variant_id) : null;

        return [
            'product' => [
                'id' => (int) $row->product_id,
                'name' => (string) ($p->name ?? ''),
                'unit' => $p?->unit ? ['id' => $p->unit->id, 'name' => $p->unit->name, 'short_name' => $p->unit->short_name] : null,
                'category' => $p?->category ? ['id' => $p->category->id, 'name' => $p->category->name, 'color' => $p->category->color] : null,
                'image_url' => $p?->imageUrl(),
            ],
            'variant' => $variant ? ['id' => $variant->id, 'name' => $variant->name] : null,
            // Tri stable des listes : nom de l'article.
            'name' => trim(($p->name ?? '').' '.($variant->name ?? '')),
        ];
    }

    /** @return array{0: CarbonImmutable, 1: CarbonImmutable} bornes UTC de la période */
    private function bounds(CarbonImmutable $start, CarbonImmutable $end): array
    {
        return [$start->startOfDay()->utc(), $end->endOfDay()->utc()];
    }

    private function periodOut(CarbonImmutable $start, CarbonImmutable $end): array
    {
        return ['from' => $start->format('Y-m-d'), 'to' => $end->format('Y-m-d'), 'days' => (int) $start->diffInDays($end) + 1];
    }
}
