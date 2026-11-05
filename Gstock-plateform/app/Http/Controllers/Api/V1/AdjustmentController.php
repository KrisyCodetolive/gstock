<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Identity\Models\User;
use App\Domain\Shops\Models\Shop;
use App\Domain\Stock\AdjustmentService;
use App\Domain\Stock\Models\Adjustment;
use App\Http\Controllers\Controller;
use App\Http\Resources\CatalogPresenter;
use App\Support\Decimal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Mouvements manuels MS-N (M07) : entrée, sortie, inventaire, annulation motivée. */
class AdjustmentController extends Controller
{
    public function __construct(private AdjustmentService $adjustments) {}

    public function show(Request $request, Shop $shop, int $id): JsonResponse
    {
        return response()->json(['data' => $this->present($this->find($request->user(), $shop, $id))]);
    }

    public function store(Request $request, Shop $shop): JsonResponse
    {
        $adjustment = $this->adjustments->create($shop, $request->user(), $request->all());

        return response()->json(['data' => $this->present($adjustment)], $adjustment->wasRecentlyCreated ? 201 : 200);
    }

    public function cancel(Request $request, Shop $shop, int $id): JsonResponse
    {
        $adjustment = Adjustment::query()->where('shop_id', $shop->id)->findOrFail($id);

        return response()->json(['data' => $this->present($this->adjustments->cancel($adjustment, $request->user(), $request->input('reason')))]);
    }

    /** Sans `records.view_all`, on ne voit que ses propres mouvements (§6.2). */
    private function find(User $user, Shop $shop, int $id): Adjustment
    {
        return Adjustment::query()->where('shop_id', $shop->id)
            ->when(! $user->hasAnyPermission('records.view_all'), fn ($q) => $q->where('user_id', $user->id))
            ->findOrFail($id);
    }

    private function present(Adjustment $a): array
    {
        $a->load(['items.product.unit', 'items.product.variants', 'user']);

        return [
            'id' => $a->id,
            'reference' => $a->reference,
            'kind' => $a->kind,
            'reason' => $a->reason,
            'exit_reason' => $a->exit_reason,
            'status' => $a->status,
            'items' => $a->items->map(fn ($item) => [
                'product' => ['id' => $item->product->id, 'name' => $item->product->articleName($item->product_variant_id), 'unit' => CatalogPresenter::unitRef($item->product->unit)],
                'variant' => ($v = $item->product_variant_id ? $item->product->variants->firstWhere('id', $item->product_variant_id) : null) ? ['id' => $v->id, 'name' => $v->name] : null,
                'quantity' => Decimal::format((string) $item->quantity),
                'counted_quantity' => Decimal::format($item->counted_quantity === null ? null : (string) $item->counted_quantity),
                'expiry_date' => $item->expiry_date,
                'stock_lot_id' => $item->stock_lot_id,
            ])->values()->all(),
            'user' => $a->user ? ['id' => $a->user->id, 'name' => $a->user->name()] : null,
            'occurred_at' => $a->occurred_at->toIso8601String(),
            'cancelled_at' => $a->cancelled_at?->toIso8601String(),
            'cancel_reason' => $a->cancel_reason,
        ];
    }
}
