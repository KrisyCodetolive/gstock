<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Platform\CurrentTenant;
use App\Domain\Shops\Models\Shop;
use App\Http\Controllers\Controller;
use App\Http\Resources\Present;
use App\Support\ApiException;
use App\Support\ListQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Boutiques de l'espace (M03, ADR-011) : jamais supprimées, désactivées. */
class ShopController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return ListQuery::respond(
            $request,
            Shop::query(),
            Present::shop(...),
            searchIn: ['name', 'city', 'district'],
            filters: ['is_active' => ListQuery::boolean('is_active')],
            sortable: ['name', 'city'],
        );
    }

    public function show(Shop $shop): JsonResponse
    {
        return response()->json(['data' => Present::shop($shop)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $shop = Shop::create($data);

        return response()->json(['data' => Present::shop($shop)], 201);
    }

    public function update(Request $request, Shop $shop): JsonResponse
    {
        $shop->update($this->validated($request, $shop));

        return response()->json(['data' => Present::shop($shop)]);
    }

    private function validated(Request $request, ?Shop $current = null): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120', Rule::unique('shops')->where('tenant_id', CurrentTenant::get()->id)->ignore($current?->id)],
            'city' => ['required', 'string', 'max:120'],
            'district' => ['nullable', 'string', 'max:120'],
            'address' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'receipt_note' => ['nullable', 'string', 'max:255'],
            'receipt_show_customer' => ['boolean'],
            'receipt_show_phone' => ['boolean'],
            'auto_print_receipt' => ['boolean'],
            'default_customer_id' => ['nullable', 'integer'],
            'is_active' => ['boolean'],
        ], [
            'name.required' => 'Donnez un nom à la boutique.',
            'name.unique' => 'Une autre boutique porte déjà ce nom.',
            'city.required' => 'Indiquez la ville de la boutique.',
        ]);
        $data = [
            'receipt_show_customer' => true, 'receipt_show_phone' => true, 'auto_print_receipt' => false, 'is_active' => true,
            ...array_map(fn ($v) => is_string($v) ? (trim($v) === '' ? null : trim($v)) : $v, $data),
        ];

        // Limite du plan sur les boutiques ouvertes ; au moins une boutique reste ouverte.
        $activeOthers = Shop::query()->where('is_active', true)->when($current, fn ($q) => $q->whereKeyNot($current->id))->count();
        $opening = $data['is_active'] && (! $current || ! $current->is_active);
        $max = CurrentTenant::plan()->max_shops;
        if ($opening && $activeOthers >= $max) {
            throw ApiException::invalid('name', "Votre abonnement permet {$max} boutiques ouvertes au maximum.");
        }
        if ($current?->is_active && ! $data['is_active'] && $activeOthers === 0) {
            throw ApiException::invalid('is_active', 'Gardez au moins une boutique ouverte.');
        }

        return $data;
    }
}
