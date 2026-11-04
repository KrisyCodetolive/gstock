<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Catalog\Models\Category;
use App\Domain\Catalog\Models\Product;
use App\Domain\Credits\CreditLedger;
use App\Domain\Customers\Models\Customer;
use App\Domain\Identity\Models\User;
use App\Domain\Platform\CurrentTenant;
use App\Domain\Sales\Models\PaymentMethod;
use App\Domain\Sales\Models\Sale;
use App\Domain\Sales\ReceiptLinks;
use App\Domain\Sales\SaleCalculator;
use App\Domain\Sales\SaleService;
use App\Domain\Shops\Models\Shop;
use App\Domain\Shops\Models\TenantPaymentSetting;
use App\Http\Controllers\Controller;
use App\Http\Resources\CatalogPresenter;
use App\Http\Resources\SalesPresenter;
use App\Support\Decimal as D;
use App\Support\ListQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Caisse et ventes (M08) : montants recalculés par le serveur, crédit automatique, annulation motivée, reçus. */
class SaleController extends Controller
{
    public function __construct(private SaleService $sales, private SaleCalculator $calculator, private ReceiptLinks $links) {}

    /** Tout ce qu'il faut à la caisse et à son cache hors ligne (ADR-005). */
    public function bootstrap(Shop $shop): JsonResponse
    {
        $products = Product::query()->with(['category', 'variants', 'unit'])->where('is_active', true)->orderBy('name')->get();
        $presenter = new CatalogPresenter($products, $shop->id);
        $geniuspay = (bool) TenantPaymentSetting::query()->value('is_active');
        $customerIds = Customer::query()->pluck('id')->all();
        $balances = SalesPresenter::balances($customerIds, [$shop->id]);
        $notes = app(CreditLedger::class)->creditNoteBalances($customerIds, [$shop->id]);

        return response()->json(['data' => [
            'products' => $products->flatMap(fn (Product $p) => array_map(fn ($a) => [
                'id' => $a['id'], 'variant_id' => $a['variant_id'], 'variant_name' => $a['variant_name'], 'type' => $a['type'],
                'name' => $a['name'], 'code' => $a['code'], 'barcode' => $a['barcode'], 'price' => $a['price'],
                'tax_rate' => $p->tax_rate === null ? null : (string) $p->tax_rate,
                'unit' => $a['unit'], 'category' => $a['category'], 'image_url' => $a['image_url'],
                'quantity' => $a['quantity'], 'state' => $a['state'],
            ], $presenter->articles($p)))->values(),
            'categories' => Category::query()->where('is_active', true)->orderBy('id')->get(['id', 'name', 'color']),
            'payment_methods' => PaymentMethod::query()->where('is_active', true)->orderBy('id')->get()->map(fn ($m) => [
                'id' => $m->id, 'name' => $m->name, 'type' => $m->type, 'uses_geniuspay' => $m->uses_geniuspay && $geniuspay,
            ]),
            'geniuspay_enabled' => $geniuspay,
            'customers' => Customer::query()->where('is_active', true)->orderBy('name')->get()->map(fn ($c) => [
                'id' => $c->id, 'name' => $c->name, 'phone' => $c->phone,
                'balance' => D::format((string) ($balances[$c->id] ?? '0'), D::MONEY),
                'credit_note' => D::format((string) ($notes[$c->id] ?? '0'), D::MONEY),
            ]),
            'generated_at' => now()->toIso8601String(),
        ]]);
    }

    /** Calcul des montants sans rien enregistrer : la caisse affiche ce que dit le serveur (§7.4). */
    public function quote(Request $request, Shop $shop): JsonResponse
    {
        return response()->json(['data' => $this->calculator->compute($request->all(), $request->user())->quote()]);
    }

    public function store(Request $request, Shop $shop): JsonResponse
    {
        $sale = $this->sales->record($shop, $request->user(), $request->all());

        return response()->json(['data' => SalesPresenter::sale($sale->fresh())], $sale->wasRecentlyCreated ? 201 : 200);
    }

    /** Historique : sans `records.view_all`, seulement ses propres ventes (§6.2). Totaux de la liste filtrée, hors annulées. */
    public function index(Request $request, Shop $shop): JsonResponse
    {
        $filters = [
            'payment_status' => fn (Builder $q, string $v) => $q->where('payment_status', $v),
            'status' => fn (Builder $q, string $v) => $q->where('status', $v),
            'sync_status' => fn (Builder $q, string $v) => $q->where('sync_status', $v),
            'customer_id' => fn (Builder $q, string $v) => $q->where('customer_id', (int) $v),
            'user_id' => fn (Builder $q, string $v) => $q->where('user_id', (int) $v),
            'from' => fn (Builder $q, string $v) => $q->where('occurred_at', '>=', $v),
            'to' => fn (Builder $q, string $v) => $q->where('occurred_at', '<=', $v),
        ];
        $search = trim((string) $request->query('search', ''));
        $needle = '%'.addcslashes($search, '%_\\').'%';
        $base = fn () => $this->visible($request->user(), $shop)
            ->when($search !== '', fn ($q) => $q->where(fn ($w) => $w->where('reference', 'ilike', $needle)
                ->orWhereIn('customer_id', Customer::query()->whereRaw('unaccent(name) ILIKE unaccent(?)', [$needle])->select('id'))));

        $totals = $base();
        foreach ((array) $request->query('filter', []) as $name => $value) {
            if (isset($filters[$name]) && $value !== null && $value !== '') {
                $filters[$name]($totals, (string) $value);
            }
        }
        $sums = $totals->where('status', 'completed')
            ->selectRaw('count(*) as count, coalesce(sum(total), 0) as total, coalesce(sum(paid_now), 0) as paid_now, coalesce(sum(credit_amount), 0) as credit_amount')
            ->toBase()->first();

        return ListQuery::respond(
            $request,
            $base()->with(['customer', 'user'])->withCount('items')->orderByDesc('occurred_at')->orderByDesc('id'),
            SalesPresenter::listItem(...),
            filters: $filters,
            extra: ['summary' => [
                'count' => (int) $sums->count,
                'total' => D::format((string) $sums->total, D::MONEY),
                'paid_now' => D::format((string) $sums->paid_now, D::MONEY),
                'credit_amount' => D::format((string) $sums->credit_amount, D::MONEY),
            ]],
        );
    }

    public function show(Request $request, Shop $shop, int $id): JsonResponse
    {
        return response()->json(['data' => SalesPresenter::sale($this->visible($request->user(), $shop)->findOrFail($id))]);
    }

    public function cancel(Request $request, Shop $shop, int $id): JsonResponse
    {
        $sale = Sale::query()->where('shop_id', $shop->id)->findOrFail($id);

        // Décision P3 : `refund_mode` (credit_note ou refund) si le crédit de la vente a déjà reçu des paiements.
        $settlement = $request->only(['refund_mode', 'refund_payment_method_id']);

        return response()->json(['data' => SalesPresenter::sale($this->sales->cancel($sale, $request->user(), $request->input('reason'), $settlement)->fresh())]);
    }

    public function receipt(Request $request, Shop $shop, int $id): JsonResponse
    {
        return response()->json(['data' => SalesPresenter::receipt($this->visible($request->user(), $shop)->findOrFail($id))]);
    }

    /** Lien de reçu à partager sur WhatsApp : signé, valable 7 jours (ADR-013). */
    public function shareLink(Request $request, Shop $shop, int $id): JsonResponse
    {
        $sale = $this->visible($request->user(), $shop)->findOrFail($id);
        ['token' => $token, 'expires_at' => $exp] = $this->links->sign('s', $shop->id, $sale->id);
        $tenant = CurrentTenant::get();
        $url = str_replace('{tenant}', $tenant->slug, config('gstock.frontend_url')).'/recu/'.$token;
        $amount = SaleCalculator::fcfa((string) $sale->total);

        return response()->json(['data' => [
            'url' => $url,
            'expires_at' => $exp->toIso8601String(),
            'message' => "Bonjour, voici votre reçu {$sale->reference} de {$tenant->name} ({$amount} FCFA) : {$url}",
        ]]);
    }

    private function visible(User $user, Shop $shop): Builder
    {
        return Sale::query()->where('shop_id', $shop->id)
            ->when(! $user->hasAnyPermission('records.view_all'), fn ($q) => $q->where('user_id', $user->id));
    }
}
