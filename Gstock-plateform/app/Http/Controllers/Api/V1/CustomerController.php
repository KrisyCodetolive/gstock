<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Credits\Models\CustomerCredit;
use App\Domain\Customers\Models\Customer;
use App\Domain\Identity\Models\User;
use App\Domain\Sales\Models\Sale;
use App\Domain\Shops\Models\Shop;
use App\Http\Controllers\Controller;
use App\Http\Resources\SalesPresenter;
use App\Support\ApiException;
use App\Support\Decimal as D;
use App\Support\ListQuery;
use App\Support\Phone;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Mes clients (M10) : communs à l'espace ; soldes calculés sur les boutiques visibles. Désactivés, jamais supprimés. */
class CustomerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $shops = $this->shopIds($request->user());
        $balances = collect();
        $inShops = $shops ? implode(',', array_map('intval', $shops)) : '0';
        $balanceSql = "(select coalesce(sum(remaining_amount), 0) from customer_credits cc where cc.customer_id = customers.id and cc.status != 'cancelled' and cc.shop_id in ({$inShops}))";

        return ListQuery::respond(
            $request,
            Customer::query()->orderBy('name'),
            function (Customer $c) use (&$balances, $shops) {
                return SalesPresenter::customer($c, $shops, (string) ($balances[$c->id] ?? '0'));
            },
            searchIn: ['name', 'phone', 'district'],
            filters: [
                'is_active' => ListQuery::boolean('is_active'),
                // « Doit de l'argent » : solde > 0.
                'has_balance' => fn (Builder $q, string $v) => $q->whereRaw($balanceSql.(filter_var($v, FILTER_VALIDATE_BOOLEAN) ? ' > 0' : ' = 0')),
            ],
            beforeMap: function ($items) use (&$balances, $shops) {
                $balances = SalesPresenter::balances($items->pluck('id')->all(), $shops);
            },
        );
    }

    public function show(Request $request, Customer $customer): JsonResponse
    {
        return response()->json(['data' => SalesPresenter::customer($customer, $this->shopIds($request->user()))]);
    }

    /** La fiche client : soldes par boutique, achats, ventes récentes, crédits. */
    public function summary(Request $request, Customer $customer): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $shops = $user->isOwner() ? Shop::query()->orderBy('id')->get() : $user->shops()->orderBy('shops.id')->get();
        $shopIds = $shops->pluck('id')->all();
        $sales = Sale::query()->with('shop')->where('customer_id', $customer->id)->whereIn('shop_id', $shopIds);
        $completed = (clone $sales)->where('status', 'completed');
        $lastAt = (clone $completed)->max('occurred_at');

        return response()->json(['data' => [
            'customer' => SalesPresenter::customer($customer, $shopIds),
            'balances' => $shops->map(fn ($shop) => [
                'shop' => ['id' => $shop->id, 'name' => $shop->name],
                'balance' => D::format(SalesPresenter::balance($customer->id, [$shop->id]), D::MONEY),
            ])->values(),
            'purchases' => [
                'count' => (clone $completed)->count(),
                'total' => D::format((string) ((clone $completed)->sum('total') ?: '0'), D::MONEY),
                'last_at' => $lastAt ? Carbon::parse($lastAt)->toIso8601String() : null,
            ],
            'recent_sales' => (clone $sales)->orderByDesc('occurred_at')->limit(10)->get()->map(fn (Sale $s) => [
                'id' => $s->id, 'reference' => $s->reference, 'shop' => ['id' => $s->shop->id, 'name' => $s->shop->name],
                'total' => D::format((string) $s->total, D::MONEY), 'payment_status' => $s->payment_status, 'status' => $s->status,
                'occurred_at' => $s->occurred_at->toIso8601String(),
            ])->values(),
            'credits' => CustomerCredit::query()->with(['shop', 'sale'])->where('customer_id', $customer->id)->whereIn('shop_id', $shopIds)
                ->orderByDesc('occurred_at')->get()->map(SalesPresenter::credit(...))->values(),
        ]]);
    }

    /** Création rapide possible depuis la caisse : nom seul obligatoire (M10). */
    public function store(Request $request): JsonResponse
    {
        $customer = Customer::create($this->validated($request));

        return response()->json(['data' => SalesPresenter::customer($customer, $this->shopIds($request->user()))], 201);
    }

    public function update(Request $request, Customer $customer): JsonResponse
    {
        $customer->update($this->validated($request, $customer));

        return response()->json(['data' => SalesPresenter::customer($customer, $this->shopIds($request->user()))]);
    }

    private function validated(Request $request, ?Customer $current = null): array
    {
        $errors = [];
        $name = trim((string) $request->input('name', ''));
        if ($name === '') {
            $errors['name'] = ['Saisissez le nom du client.'];
        }
        $phone = Phone::normalize($request->input('phone'));
        if ($phone !== null) {
            if (! preg_match('/^\d{8,12}$/', $phone)) {
                $errors['phone'] = ["Ce numéro de téléphone n'est pas valide."];
            } elseif (Customer::query()->where('phone', $phone)->when($current, fn ($q) => $q->whereKeyNot($current->id))->exists()) {
                $errors['phone'] = ['Un autre client a déjà ce numéro.'];
            }
        }
        if ($errors) {
            throw new ApiException(422, 'Les informations saisies ne sont pas valides.', $errors);
        }
        $clean = fn (string $k) => filled($request->input($k)) ? trim((string) $request->input($k)) : null;

        return ['name' => $name, 'phone' => $phone, 'district' => $clean('district'), 'note' => $clean('note'), 'is_active' => $request->input('is_active') !== false];
    }

    /** Boutiques dont l'utilisateur peut voir les opérations (§6.2). @return list<int> */
    private function shopIds(User $user): array
    {
        return $user->isOwner() ? Shop::query()->pluck('id')->all() : $user->shops()->pluck('shops.id')->all();
    }
}
