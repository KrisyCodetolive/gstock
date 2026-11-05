<?php

namespace App\Http\Resources;

use App\Domain\Credits\InstallmentSchedule;
use App\Domain\Expenses\Models\Expense;
use App\Domain\Purchases\Models\Purchase;
use App\Domain\Purchases\Models\PurchasePayment;
use App\Domain\Purchases\Models\Supplier;
use App\Domain\Purchases\PurchaseService;
use App\Support\Decimal as D;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/** Formes JSON des fournisseurs, approvisionnements et dépenses (`Gstock-frontend/src/types/purchases.ts`). */
final class PurchasesPresenter
{
    /** @param  ?array{purchased: string, paid: string, due: string}  $totals */
    public static function supplier(Supplier $s, array $shopIds, ?array $totals = null): array
    {
        $totals ??= self::supplierTotals([$s->id], $shopIds)[$s->id] ?? null;

        return [
            'id' => $s->id,
            'name' => $s->name,
            'phone' => $s->phone,
            'address' => $s->address,
            'note' => $s->note,
            'is_active' => $s->is_active,
            'purchased_total' => D::format($totals['purchased'] ?? '0', D::MONEY),
            'paid_total' => D::format($totals['paid'] ?? '0', D::MONEY),
            'due_total' => D::format($totals['due'] ?? '0', D::MONEY),
        ];
    }

    /**
     * Totaux par fournisseur sur les boutiques visibles, hors approvisionnements annulés.
     *
     * @return Collection<int, array{purchased: string, paid: string, due: string}>
     */
    public static function supplierTotals(array $supplierIds, array $shopIds): Collection
    {
        return DB::table('purchases')->where('tenant_id', tenant('id'))->whereIn('supplier_id', $supplierIds)->whereIn('shop_id', $shopIds ?: [0])
            ->where('status', 'received')->groupBy('supplier_id')
            ->selectRaw('supplier_id, sum(total) as purchased, sum(paid_amount) as paid, sum(greatest(total - paid_amount, 0)) as due')
            ->get()->mapWithKeys(fn ($r) => [$r->supplier_id => ['purchased' => (string) $r->purchased, 'paid' => (string) $r->paid, 'due' => (string) $r->due]]);
    }

    public static function purchase(Purchase $p): array
    {
        $p->loadMissing(['shop', 'supplier', 'user', 'items.product.unit', 'items.product.variants', 'items.unit', 'payments.method', 'payments.user']);
        $due = PurchaseService::due($p);

        return [
            'id' => $p->id,
            'reference' => $p->reference,
            'shop' => ['id' => $p->shop->id, 'name' => $p->shop->name],
            'supplier' => $p->supplier ? ['id' => $p->supplier->id, 'name' => $p->supplier->name, 'phone' => $p->supplier->phone] : null,
            'occurred_at' => $p->occurred_at->toIso8601String(),
            'items' => $p->items->map(function ($i) {
                $variant = $i->product_variant_id ? $i->product->variants->firstWhere('id', $i->product_variant_id) : null;

                return [
                    'product' => ['id' => $i->product->id, 'name' => $i->product->articleName($i->product_variant_id), 'unit' => CatalogPresenter::unitRef($i->product->unit)],
                    'variant' => $variant ? ['id' => $variant->id, 'name' => $variant->name] : null,
                    'unit' => CatalogPresenter::unitRef($i->unit),
                    'quantity' => D::format((string) $i->quantity),
                    'base_quantity' => D::format((string) $i->base_quantity),
                    'cost' => D::format((string) $i->cost, D::MONEY),
                    'subtotal' => D::format((string) $i->subtotal, D::MONEY),
                    'expiry_date' => $i->expiry_date,
                ];
            })->values()->all(),
            'subtotal' => D::format((string) $p->subtotal, D::MONEY),
            'discount' => D::format((string) $p->discount, D::MONEY),
            'total' => D::format((string) $p->total, D::MONEY),
            'paid_amount' => D::format((string) $p->paid_amount, D::MONEY),
            'due_amount' => $due,
            'payment_status' => $p->payment_status,
            'status' => $p->status,
            'payments' => $p->payments->map(self::payment(...))->values()->all(),
            'installments' => self::installments($p),
            'note' => $p->note,
            'user' => $p->user ? ['id' => $p->user->id, 'name' => $p->user->name()] : null,
            'cancelled_at' => $p->cancelled_at?->toIso8601String(),
            'cancel_reason' => $p->cancel_reason,
        ];
    }

    public static function listItem(Purchase $p): array
    {
        $p->loadMissing('supplier');
        $overdue = collect(self::installments($p))->where('status', 'overdue')
            ->reduce(fn ($s, $i) => D::add($s, D::sub($i['amount'], $i['paid_amount'], D::MONEY), D::MONEY), '0.00');

        return [
            'id' => $p->id,
            'reference' => $p->reference,
            'supplier' => $p->supplier ? ['id' => $p->supplier->id, 'name' => $p->supplier->name, 'phone' => $p->supplier->phone] : null,
            'occurred_at' => $p->occurred_at->toIso8601String(),
            'total' => D::format((string) $p->total, D::MONEY),
            'paid_amount' => D::format((string) $p->paid_amount, D::MONEY),
            'due_amount' => PurchaseService::due($p),
            'payment_status' => $p->payment_status,
            'status' => $p->status,
            'items_count' => (int) ($p->items_count ?? $p->items()->count()),
            'overdue_amount' => $overdue,
        ];
    }

    /** Échéancier de la dette fournisseur, soldé par les paiements (§7.7) ; vide si annulé. */
    public static function installments(Purchase $p): array
    {
        return $p->status === 'cancelled' ? [] : InstallmentSchedule::of(Purchase::PAYABLE, $p->id, PurchaseService::due($p));
    }

    public static function payment(PurchasePayment $x): array
    {
        return [
            'id' => $x->id,
            'amount' => D::format((string) $x->amount, D::MONEY),
            'method' => ['id' => $x->method->id, 'name' => $x->method->name],
            'paid_at' => $x->paid_at->toIso8601String(),
            'note' => $x->note,
            'user' => $x->user ? ['id' => $x->user->id, 'name' => $x->user->name()] : null,
            'status' => $x->status,
        ];
    }

    public static function expense(Expense $e): array
    {
        $e->loadMissing(['category', 'method', 'user']);

        return [
            'id' => $e->id,
            'reference' => $e->reference,
            'occurred_at' => $e->occurred_at->toIso8601String(),
            'category' => ['id' => $e->category->id, 'name' => $e->category->name],
            'amount' => D::format((string) $e->amount, D::MONEY),
            'method' => ['id' => $e->method->id, 'name' => $e->method->name],
            'note' => $e->note,
            'user' => $e->user ? ['id' => $e->user->id, 'name' => $e->user->name()] : null,
            'status' => $e->status,
            'cancelled_at' => $e->cancelled_at?->toIso8601String(),
            'cancel_reason' => $e->cancel_reason,
        ];
    }
}
