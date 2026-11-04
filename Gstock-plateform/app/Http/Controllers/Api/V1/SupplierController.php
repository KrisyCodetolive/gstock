<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Identity\Models\User;
use App\Domain\Purchases\Models\Supplier;
use App\Domain\Shops\Models\Shop;
use App\Http\Controllers\Controller;
use App\Http\Resources\PurchasesPresenter;
use App\Support\ApiException;
use App\Support\ListQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Fournisseurs (M11) : communs à l'espace ; totaux sur les boutiques visibles. Désactivés, jamais supprimés. */
class SupplierController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $shops = $this->shopIds($request->user());
        $totals = collect();
        $inShops = $shops ? implode(',', array_map('intval', $shops)) : '0';
        $dueSql = "(select coalesce(sum(greatest(total - paid_amount, 0)), 0) from purchases p where p.supplier_id = suppliers.id and p.status = 'received' and p.shop_id in ({$inShops}))";

        return ListQuery::respond(
            $request,
            Supplier::query()->orderBy('name'),
            function (Supplier $s) use (&$totals, $shops) {
                return PurchasesPresenter::supplier($s, $shops, $totals[$s->id] ?? []);
            },
            searchIn: ['name', 'phone'],
            filters: [
                'is_active' => ListQuery::boolean('is_active'),
                // Fournisseurs à qui l'on doit encore de l'argent.
                'has_due' => fn (Builder $q, string $v) => $q->whereRaw($dueSql.(filter_var($v, FILTER_VALIDATE_BOOLEAN) ? ' > 0' : ' = 0')),
            ],
            beforeMap: function ($items) use (&$totals, $shops) {
                $totals = PurchasesPresenter::supplierTotals($items->pluck('id')->all(), $shops);
            },
        );
    }

    public function show(Request $request, Supplier $supplier): JsonResponse
    {
        return response()->json(['data' => PurchasesPresenter::supplier($supplier, $this->shopIds($request->user()))]);
    }

    public function store(Request $request): JsonResponse
    {
        $supplier = Supplier::create($this->validated($request));

        return response()->json(['data' => PurchasesPresenter::supplier($supplier, $this->shopIds($request->user()))], 201);
    }

    public function update(Request $request, Supplier $supplier): JsonResponse
    {
        $supplier->update($this->validated($request, $supplier));

        return response()->json(['data' => PurchasesPresenter::supplier($supplier, $this->shopIds($request->user()))]);
    }

    private function validated(Request $request, ?Supplier $current = null): array
    {
        $name = trim((string) $request->input('name', ''));
        if ($name === '') {
            throw ApiException::invalid('name', 'Saisissez le nom du fournisseur.');
        }
        if (Supplier::query()->whereRaw('lower(unaccent(name)) = lower(unaccent(?))', [$name])->when($current, fn ($q) => $q->whereKeyNot($current->id))->exists()) {
            throw ApiException::invalid('name', 'Un autre fournisseur porte déjà ce nom.');
        }
        $clean = fn (string $k) => filled($request->input($k)) ? trim((string) $request->input($k)) : null;

        return ['name' => $name, 'phone' => $clean('phone'), 'address' => $clean('address'), 'note' => $clean('note'), 'is_active' => $request->input('is_active') !== false];
    }

    /** @return list<int> */
    private function shopIds(User $user): array
    {
        return $user->isOwner() ? Shop::query()->pluck('id')->all() : $user->shops()->pluck('shops.id')->all();
    }
}
