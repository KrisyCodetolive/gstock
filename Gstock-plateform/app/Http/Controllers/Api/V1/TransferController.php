<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Shops\Models\Shop;
use App\Domain\Stock\Models\StockTransfer;
use App\Domain\Stock\TransferService;
use App\Http\Controllers\Controller;
use App\Http\Resources\CatalogPresenter;
use App\Support\Decimal;
use App\Support\ListQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Transferts de stock entre boutiques (§7.12), vus depuis une boutique : envoyés ou reçus. */
class TransferController extends Controller
{
    public function __construct(private TransferService $transfers) {}

    /** ?direction=out (envoyés), in (reçus), ou les deux ; filter[status]. */
    public function index(Request $request, Shop $shop): JsonResponse
    {
        $direction = $request->query('direction');
        $query = StockTransfer::query()->with(['fromShop', 'toShop', 'items', 'sender'])
            ->where(fn (Builder $q) => match ($direction) {
                'out' => $q->where('from_shop_id', $shop->id),
                'in' => $q->where('to_shop_id', $shop->id),
                default => $q->where('from_shop_id', $shop->id)->orWhere('to_shop_id', $shop->id),
            })
            ->orderByRaw("status = 'in_transit' DESC")->orderByDesc('sent_at')->orderByDesc('id');
        $toReceive = StockTransfer::query()->where('to_shop_id', $shop->id)->where('status', 'in_transit')->count();

        return ListQuery::respond(
            $request,
            $query,
            fn (StockTransfer $t) => $this->summary($t, $shop),
            searchIn: ['reference'],
            filters: ['status' => fn (Builder $q, string $v) => $q->where('status', $v)],
            extra: ['summary' => ['to_receive' => $toReceive]],
        );
    }

    public function show(Shop $shop, int $id): JsonResponse
    {
        return response()->json(['data' => $this->present($this->find($shop, $id), $shop)]);
    }

    public function store(Request $request, Shop $shop): JsonResponse
    {
        $transfer = $this->transfers->send($shop, $request->user(), $request->all());

        return response()->json(['data' => $this->present($transfer, $shop)], 201);
    }

    public function receive(Request $request, Shop $shop, int $id): JsonResponse
    {
        return response()->json(['data' => $this->present($this->transfers->receive($this->find($shop, $id), $shop, $request->user(), $request->all()), $shop)]);
    }

    public function cancel(Request $request, Shop $shop, int $id): JsonResponse
    {
        return response()->json(['data' => $this->present($this->transfers->cancel($this->find($shop, $id), $shop, $request->user(), $request->input('reason')), $shop)]);
    }

    /** Un transfert se voit depuis l'une de ses deux boutiques. */
    private function find(Shop $shop, int $id): StockTransfer
    {
        return StockTransfer::query()->where(fn ($q) => $q->where('from_shop_id', $shop->id)->orWhere('to_shop_id', $shop->id))->findOrFail($id);
    }

    private function summary(StockTransfer $t, Shop $shop): array
    {
        return [
            'id' => $t->id,
            'reference' => $t->reference,
            'status' => $t->status,
            // Sens vu depuis la boutique demandée.
            'direction' => $t->from_shop_id === $shop->id ? 'out' : 'in',
            'from_shop' => ['id' => $t->fromShop->id, 'name' => $t->fromShop->name],
            'to_shop' => ['id' => $t->toShop->id, 'name' => $t->toShop->name],
            'lines' => $t->items->count(),
            'quantity' => Decimal::format($t->items->reduce(fn ($s, $i) => Decimal::add($s, (string) $i->quantity), '0')),
            'sent_at' => $t->sent_at->toIso8601String(),
            'sent_by' => $t->sender ? ['id' => $t->sender->id, 'name' => $t->sender->name()] : null,
            'received_at' => $t->received_at?->toIso8601String(),
        ];
    }

    private function present(StockTransfer $t, Shop $shop): array
    {
        $t->load(['fromShop', 'toShop', 'sender', 'receiver', 'items.product.unit', 'items.product.variants']);
        $missing = '0';
        $items = $t->items->map(function ($i) use (&$missing) {
            $gap = $i->received_quantity === null ? '0' : Decimal::sub((string) $i->quantity, (string) $i->received_quantity);
            if ($i->unit_cost !== null) {
                $missing = Decimal::add($missing, Decimal::mul($gap, (string) $i->unit_cost, 2), 2);
            }
            $variant = $i->product_variant_id ? $i->product->variants->firstWhere('id', $i->product_variant_id) : null;

            return [
                'product' => ['id' => $i->product->id, 'name' => $i->product->articleName($i->product_variant_id), 'unit' => CatalogPresenter::unitRef($i->product->unit)],
                'variant' => $variant ? ['id' => $variant->id, 'name' => $variant->name] : null,
                'quantity' => Decimal::format((string) $i->quantity),
                'received_quantity' => Decimal::format($i->received_quantity === null ? null : (string) $i->received_quantity),
                'missing_quantity' => Decimal::format($gap),
                'unit_cost' => Decimal::format($i->unit_cost === null ? null : (string) $i->unit_cost, 2),
            ];
        })->values()->all();

        return [
            ...$this->summary($t, $shop),
            'items' => $items,
            'note' => $t->note,
            'received_by' => $t->receiver ? ['id' => $t->receiver->id, 'name' => $t->receiver->name()] : null,
            'reception_note' => $t->reception_note,
            // Valeur du manque au prix d'achat : comptée dans les pertes (§7.8).
            'missing_value' => Decimal::format($missing, 2),
            'cancelled_at' => $t->cancelled_at?->toIso8601String(),
            'cancel_reason' => $t->cancel_reason,
        ];
    }
}
