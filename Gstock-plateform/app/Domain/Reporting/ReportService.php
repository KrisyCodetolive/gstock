<?php

namespace App\Domain\Reporting;

use App\Domain\Catalog\Models\Product;
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
                'items' => $restock->map(function ($r) use ($refs) {
                    $perDay = D::div((string) $r->sold, (string) self::VELOCITY_DAYS, 3);
                    $daysLeft = (float) $r->quantity <= 0 ? 0 : (int) floor((float) $r->quantity / ((float) $r->sold / self::VELOCITY_DAYS));

                    return [
                        ...$this->ref($refs, $r),
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
