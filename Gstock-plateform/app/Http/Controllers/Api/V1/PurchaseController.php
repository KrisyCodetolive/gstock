<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Credits\InstallmentSchedule;
use App\Domain\Credits\Models\Installment;
use App\Domain\Identity\Models\User;
use App\Domain\Purchases\Models\Purchase;
use App\Domain\Purchases\Models\Supplier;
use App\Domain\Purchases\PurchaseService;
use App\Domain\Shops\Models\Shop;
use App\Http\Controllers\Controller;
use App\Http\Resources\CatalogPresenter;
use App\Http\Resources\PurchasesPresenter;
use App\Support\Decimal as D;
use App\Support\ListQuery;
use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Approvisionnements AP-N (M11) : total calculé par le serveur, entrée en stock, paiements, échéancier, annulation. */
class PurchaseController extends Controller
{
    public function __construct(private PurchaseService $purchases) {}

    /** Total calculé par le serveur, sans rien enregistrer (§7.4). */
    public function quote(Request $request, Shop $shop): JsonResponse
    {
        $c = $this->purchases->compute($request->all());

        return response()->json(['data' => [
            'items' => array_map(fn ($i) => [
                'product_id' => $i['article']->product->id,
                'variant_id' => $i['article']->variantId(),
                'unit' => CatalogPresenter::unitRef($i['unit']),
                'quantity' => $i['quantity'],
                'base_quantity' => $i['base_quantity'],
                'cost' => $i['cost'],
                'subtotal' => $i['subtotal'],
            ], $c['items']),
            'subtotal' => $c['subtotal'],
            'discount' => $c['discount'],
            'total' => $c['total'],
        ]]);
    }

    public function store(Request $request, Shop $shop): JsonResponse
    {
        $purchase = $this->purchases->record($shop, $request->user(), $request->all());

        return response()->json(['data' => PurchasesPresenter::purchase($purchase->fresh())], 201);
    }

    /** Historique : sans `records.view_all`, ses propres approvisionnements (§6.2). Totaux de la liste filtrée, hors annulés. */
    public function index(Request $request, Shop $shop): JsonResponse
    {
        $filters = $this->filters($shop);
        $base = $this->visible($request->user(), $shop)->orderByDesc('occurred_at');
        $search = trim((string) $request->query('search', ''));
        if ($search !== '') {
            $needle = '%'.addcslashes($search, '%_\\').'%';
            $base->where(fn ($q) => $q->where('reference', 'ilike', $needle)
                ->orWhereIn('supplier_id', Supplier::query()->whereRaw('unaccent(name) ILIKE unaccent(?)', [$needle])->select('id')));
        }
        $counted = (clone $base)->where('status', 'received');
        foreach ((array) $request->query('filter', []) as $name => $value) {
            if (isset($filters[$name]) && filled($value)) {
                $filters[$name]($counted, (string) $value);
            }
        }
        $sums = $counted->toBase()->reorder()->selectRaw('count(*) as n, coalesce(sum(total), 0) as total, coalesce(sum(paid_amount), 0) as paid, coalesce(sum(greatest(total - paid_amount, 0)), 0) as due')->first();

        return ListQuery::respond($request, $base->withCount('items'), fn (Purchase $p) => PurchasesPresenter::listItem($p), filters: $filters, extra: [
            'summary' => [
                'count' => (int) $sums->n,
                'total' => D::format((string) $sums->total, D::MONEY),
                'paid' => D::format((string) $sums->paid, D::MONEY),
                'due' => D::format((string) $sums->due, D::MONEY),
            ],
        ]);
    }

    public function show(Request $request, Shop $shop, int $id): JsonResponse
    {
        return response()->json(['data' => PurchasesPresenter::purchase($this->visible($request->user(), $shop)->findOrFail($id))]);
    }

    public function addPayment(Request $request, Shop $shop, int $id): JsonResponse
    {
        $purchase = $this->purchases->addPayment(Purchase::query()->where('shop_id', $shop->id)->findOrFail($id), $request->user(), $request->all());

        return response()->json(['data' => PurchasesPresenter::purchase($purchase->fresh())]);
    }

    public function setInstallments(Request $request, Shop $shop, int $id): JsonResponse
    {
        $purchase = $this->visible($request->user(), $shop)->findOrFail($id);
        $this->purchases->setInstallments($purchase, array_values((array) $request->input('installments', [])));

        return response()->json(['data' => PurchasesPresenter::purchase($purchase->fresh())]);
    }

    /** Fournisseur attribué plus tard, seulement s'il manque (M11, ADR-012). */
    public function assignSupplier(Request $request, Shop $shop, int $id): JsonResponse
    {
        $purchase = $this->purchases->assignSupplier($this->visible($request->user(), $shop)->findOrFail($id), $request->user(), $request->input('supplier_id'));

        return response()->json(['data' => PurchasesPresenter::purchase($purchase->fresh())]);
    }

    public function cancel(Request $request, Shop $shop, int $id): JsonResponse
    {
        $purchase = $this->purchases->cancel(Purchase::query()->where('shop_id', $shop->id)->findOrFail($id), $request->user(), $request->input('reason'));

        return response()->json(['data' => PurchasesPresenter::purchase($purchase->fresh())]);
    }

    /** @return array<string, Closure(Builder, string): void> */
    private function filters(Shop $shop): array
    {
        return [
            'supplier_id' => fn (Builder $q, string $v) => $q->where('supplier_id', (int) $v),
            'payment_status' => fn (Builder $q, string $v) => $q->where('status', 'received')->where('payment_status', $v),
            'from' => fn (Builder $q, string $v) => $q->where('occurred_at', '>=', $v),
            'to' => fn (Builder $q, string $v) => $q->where('occurred_at', '<=', $v),
            // Dettes fournisseurs avec une échéance dépassée non payée (§7.7).
            'overdue' => function (Builder $q, string $v) use ($shop) {
                $ids = $this->overdueIds($shop);
                filter_var($v, FILTER_VALIDATE_BOOLEAN) ? $q->whereIn('id', $ids ?: [0]) : $q->whereNotIn('id', $ids);
            },
        ];
    }

    /** @return list<int> */
    private function overdueIds(Shop $shop): array
    {
        $withSchedule = Installment::query()->where('payable_type', Purchase::PAYABLE)->where('due_date', '<', now()->toDateString())->distinct()->pluck('payable_id');

        return Purchase::query()->where('shop_id', $shop->id)->where('status', 'received')->whereIn('id', $withSchedule)->get()
            ->filter(fn (Purchase $p) => collect(InstallmentSchedule::of(Purchase::PAYABLE, $p->id, PurchaseService::due($p)))->contains('status', 'overdue'))
            ->pluck('id')->all();
    }

    /** Sans `records.view_all`, on ne voit que ses propres approvisionnements (§6.2). */
    private function visible(User $user, Shop $shop): Builder
    {
        return Purchase::query()->where('shop_id', $shop->id)
            ->when(! $user->hasAnyPermission('records.view_all'), fn ($q) => $q->where('user_id', $user->id));
    }
}
