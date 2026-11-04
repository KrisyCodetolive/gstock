<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Catalog\Models\Product;
use App\Domain\Identity\Models\User;
use App\Domain\Shops\Models\Shop;
use App\Domain\Stock\Models\ShopStock;
use App\Domain\Stock\Models\StockMovement;
use App\Http\Controllers\Controller;
use App\Http\Resources\CatalogPresenter;
use App\Support\Decimal;
use App\Support\ListQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

/** Mon stock (M07) : quantités d'une boutique, alertes, toutes les boutiques, mouvements. */
class StockController extends Controller
{
    /** État d'une ligne de stock, calculé par PostgreSQL : rupture, faible (sous le seuil), ok. */
    public const STATE = "CASE WHEN shop_stock.quantity <= 0 THEN 'out'
        WHEN coalesce(shop_stock.stock_alert, products.stock_alert) IS NOT NULL
         AND shop_stock.quantity <= coalesce(shop_stock.stock_alert, products.stock_alert) THEN 'low' ELSE 'ok' END";

    public function index(Request $request, Shop $shop): JsonResponse
    {
        return $this->list($request, $shop, false);
    }

    public function alerts(Request $request, Shop $shop): JsonResponse
    {
        return $this->list($request, $shop, true);
    }

    /** Une ligne par article (produit simple ou variante, même désactivée : son stock reste visible). */
    private function list(Request $request, Shop $shop, bool $onlyAlerts): JsonResponse
    {
        $base = fn () => ShopStock::query()
            ->join('products', 'products.id', '=', 'shop_stock.product_id')
            ->leftJoin('product_variants', 'product_variants.id', '=', 'shop_stock.product_variant_id')
            ->where('shop_stock.shop_id', $shop->id)
            ->where('products.is_active', true)
            ->where('products.type', '!=', 'service')
            // Une ligne « produit » d'un produit à variantes n'existe pas ; par sûreté on l'écarte.
            ->whereRaw("(products.type = 'variable') = (shop_stock.product_variant_id IS NOT NULL)");

        // Totaux de la boutique, indépendants de la recherche et de la page (§M07).
        $totals = $base()->selectRaw('count(*) as products')
            ->selectRaw('count(*) filter (where '.self::STATE." = 'low') as low")
            ->selectRaw('count(*) filter (where '.self::STATE." = 'out') as out")
            ->selectRaw('coalesce(sum(shop_stock.quantity * coalesce(product_variants.cost, products.cost)), 0) as value')
            ->toBase()->first();

        $query = $base()
            ->select('shop_stock.*')->selectRaw(self::STATE.' as state')
            ->with(['product.category', 'product.unit', 'product.variants'])
            ->when($onlyAlerts, fn ($q) => $q->whereRaw(self::STATE." != 'ok'"))
            ->orderBy('products.name')->orderBy('product_variants.id');

        return ListQuery::respond(
            $request,
            $query,
            fn (ShopStock $row) => $this->stockItem($row),
            searchIn: ['products.name', 'products.code', 'product_variants.name'],
            filters: [
                'state' => fn (Builder $q, string $v) => $q->whereRaw(self::STATE.' = ?', [$v]),
                'category_id' => fn (Builder $q, string $v) => $q->where('products.category_id', (int) $v),
            ],
            extra: ['summary' => [
                'products' => (int) $totals->products,
                'low' => (int) $totals->low,
                'out' => (int) $totals->out,
                'value' => Decimal::format((string) $totals->value, 2),
            ]],
        );
    }

    private function stockItem(ShopStock $row): array
    {
        $p = $row->product;
        $variant = $row->product_variant_id ? $p->variants->firstWhere('id', $row->product_variant_id) : null;
        $alert = $row->stock_alert ?? $p->stock_alert;
        $cost = $variant ? $variant->cost : $p->cost;

        return [
            'variant' => $variant ? ['id' => $variant->id, 'name' => $variant->name] : null,
            'product' => $this->productRef($p, $row->product_variant_id),
            'quantity' => Decimal::format((string) $row->quantity),
            'stock_alert' => Decimal::format($alert === null ? null : (string) $alert),
            'cost' => Decimal::format($cost === null ? null : (string) $cost, 2),
            'value' => $cost === null ? null : Decimal::mul((string) $row->quantity, (string) $cost, 2),
            'state' => $row->state ?? CatalogPresenter::state((string) $row->quantity, $alert === null ? null : (string) $alert),
        ];
    }

    private function productRef(Product $p, ?int $variantId): array
    {
        return [
            'id' => $p->id,
            'name' => $p->articleName($variantId),
            'code' => $p->code,
            'category' => $p->category ? ['id' => $p->category->id, 'name' => $p->category->name, 'color' => $p->category->color] : null,
            'unit' => CatalogPresenter::unitRef($p->unit),
            'image_url' => $p->imageUrl(),
            'is_active' => $p->is_active,
        ];
    }

    /** Vue « Toutes mes boutiques » : quantité par boutique accessible et total. */
    public function overview(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $shops = $user->accessibleShops();
        $stock = ShopStock::query()->whereIn('shop_id', $shops->pluck('id'))->get()
            ->groupBy(fn (ShopStock $s) => $s->product_id.'|'.($s->product_variant_id ?? 0));
        $search = mb_strtolower(trim((string) $request->query('search', '')));
        $category = $request->input('filter.category_id');

        $rows = Product::query()->with(['category', 'unit', 'variants'])->where('is_active', true)->where('type', '!=', 'service')
            ->when($category, fn ($q) => $q->where('category_id', (int) $category))->orderBy('name')->get()
            ->flatMap(fn (Product $p) => collect($p->stockKeys())->map(fn ($variantId) => [$p, $variantId]))
            ->filter(fn ($a) => $search === '' || str_contains(mb_strtolower($a[0]->articleName($a[1]).' '.$a[0]->code), $search))
            ->map(function ($a) use ($shops, $stock) {
                [$p, $variantId] = $a;
                $variant = $variantId ? $p->variants->firstWhere('id', $variantId) : null;
                $rowsByShop = ($stock->get($p->id.'|'.($variantId ?? 0)) ?? collect())->keyBy('shop_id');
                $perShop = $shops->map(function (Shop $shop) use ($rowsByShop, $p) {
                    $row = $rowsByShop->get($shop->id);
                    $quantity = (string) ($row?->quantity ?? '0');
                    $alert = $row?->stock_alert ?? $p->stock_alert;

                    return ['shop_id' => $shop->id, 'quantity' => Decimal::format($quantity), 'state' => CatalogPresenter::state($quantity, $alert === null ? null : (string) $alert)];
                })->values();

                return [
                    'variant' => $variant ? ['id' => $variant->id, 'name' => $variant->name] : null,
                    'product' => $this->productRef($p, $variantId),
                    'total' => Decimal::format($perShop->reduce(fn ($s, $x) => Decimal::add($s, $x['quantity']), '0')),
                    'shops' => $perShop->all(),
                ];
            })->values();

        $perPage = min(100, max(1, (int) $request->query('per_page', 20)));
        $page = new LengthAwarePaginator($rows->forPage((int) $request->query('page', 1), $perPage)->values(), $rows->count(), $perPage, (int) $request->query('page', 1));

        return response()->json(['data' => $page->items(), 'meta' => [
            'current_page' => $page->currentPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'last_page' => $page->lastPage(),
        ]]);
    }

    /**
     * Mouvements de la boutique, du plus récent au plus ancien, avec le stock après
     * chaque mouvement (cumul par article). Sans `records.view_all`, seulement les siens.
     */
    public function movements(Request $request, Shop $shop): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $withBalance = DB::table('stock_movements')->where('tenant_id', tenant('id'))->where('shop_id', $shop->id)
            ->select('stock_movements.*')
            ->selectRaw('sum(quantity) over (partition by product_id, product_variant_id order by occurred_at, id) as balance');

        $query = StockMovement::query()->fromSub($withBalance, 'stock_movements')
            ->with(['product.unit', 'product.variants', 'user'])
            ->when($request->filled('product_id'), fn ($q) => $q->where('product_id', (int) $request->query('product_id')))
            ->when(! $user->hasAnyPermission('records.view_all'), fn ($q) => $q->where('user_id', $user->id))
            ->when(trim((string) $request->query('search', '')) !== '', function ($q) use ($request) {
                $needle = '%'.addcslashes(trim((string) $request->query('search')), '%_\\').'%';
                $q->where(fn ($w) => $w->where('reference', 'ilike', $needle)
                    ->orWhereIn('product_id', Product::query()->whereRaw('unaccent(name) ILIKE unaccent(?)', [$needle])->select('id')));
            })
            ->orderByDesc('occurred_at')->orderByDesc('id');

        return ListQuery::respond(
            $request,
            $query,
            fn (StockMovement $m) => [
                'id' => $m->id,
                'product' => ['id' => $m->product->id, 'name' => $m->product->articleName($m->product_variant_id), 'unit' => CatalogPresenter::unitRef($m->product->unit)],
                'variant' => ($v = $m->product_variant_id ? $m->product->variants->firstWhere('id', $m->product_variant_id) : null) ? ['id' => $v->id, 'name' => $v->name] : null,
                'quantity' => Decimal::format((string) $m->quantity),
                'balance' => Decimal::format((string) $m->balance),
                'source_type' => $m->source_type,
                'source_id' => $m->source_id,
                'reference' => $m->reference,
                'reason' => $m->reason,
                'user' => $m->user ? ['id' => $m->user->id, 'name' => $m->user->name()] : null,
                'occurred_at' => $m->occurred_at->toIso8601String(),
            ],
            filters: ['source_type' => fn (Builder $q, string $v) => $q->where('source_type', $v)],
        );
    }
}
