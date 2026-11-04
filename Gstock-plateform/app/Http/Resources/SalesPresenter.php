<?php

namespace App\Http\Resources;

use App\Domain\Credits\CreditLedger;
use App\Domain\Credits\Models\CustomerCredit;
use App\Domain\Customers\Models\Customer;
use App\Domain\Platform\CurrentTenant;
use App\Domain\Sales\Models\Sale;
use App\Domain\Sales\Models\SalePayment;
use App\Support\Decimal as D;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/** Formes JSON des clients et des ventes, identiques à `Gstock-frontend/src/types/customers.ts` et `sales.ts`. */
final class SalesPresenter
{
    /** @param  list<int>  $shopIds  boutiques visibles : les soldes ne portent que sur elles */
    public static function customer(Customer $c, array $shopIds, ?string $balance = null): array
    {
        return [
            'id' => $c->id,
            'name' => $c->name,
            'phone' => $c->phone,
            'district' => $c->district,
            'note' => $c->note,
            'is_active' => $c->is_active,
            'created_at' => $c->created_at->toIso8601String(),
            'balance' => D::format($balance ?? self::balance($c->id, $shopIds), D::MONEY),
            // Avoir : somme que la boutique doit au client (décision P3).
            'credit_note_balance' => app(CreditLedger::class)->creditNoteBalance($c->id, $shopIds),
        ];
    }

    /** Reste à payer : somme des restes de ses crédits non annulés (§7.6). */
    public static function balance(int $customerId, array $shopIds): string
    {
        return (string) (CustomerCredit::query()->where('customer_id', $customerId)->whereIn('shop_id', $shopIds)
            ->where('status', '!=', 'cancelled')->sum('remaining_amount') ?: '0');
    }

    public static function credit(CustomerCredit $credit): array
    {
        return [
            'id' => $credit->id,
            'reference' => $credit->reference,
            'shop' => ['id' => $credit->shop->id, 'name' => $credit->shop->name],
            'sale' => $credit->sale ? ['id' => $credit->sale->id, 'reference' => $credit->sale->reference] : null,
            'is_opening_balance' => $credit->is_opening_balance,
            'amount' => D::format((string) $credit->amount, D::MONEY),
            'remaining_amount' => D::format((string) $credit->remaining_amount, D::MONEY),
            'status' => $credit->status,
            'occurred_at' => $credit->occurred_at->toIso8601String(),
        ];
    }

    /** Ressource /shops/{id}/sales/{id} */
    public static function sale(Sale $s): array
    {
        $s->loadMissing(['shop', 'customer', 'user', 'items.product.unit', 'items.product.variants', 'payments.method', 'credit']);
        $credit = $s->credit;

        return [
            'id' => $s->id,
            'reference' => $s->reference,
            'shop' => ['id' => $s->shop->id, 'name' => $s->shop->name],
            'customer' => $s->customer ? ['id' => $s->customer->id, 'name' => $s->customer->name, 'phone' => $s->customer->phone] : null,
            'user' => $s->user ? ['id' => $s->user->id, 'name' => $s->user->name()] : null,
            'occurred_at' => $s->occurred_at->toIso8601String(),
            'items' => $s->items->map(fn ($i) => [
                'product' => ['id' => $i->product->id, 'name' => $i->product->articleName($i->product_variant_id), 'type' => $i->product->type, 'unit' => CatalogPresenter::unitRef($i->product->unit)],
                'variant' => ($v = $i->product_variant_id ? $i->product->variants->firstWhere('id', $i->product_variant_id) : null) ? ['id' => $v->id, 'name' => $v->name] : null,
                'quantity' => D::format((string) $i->quantity),
                'price' => D::format((string) $i->price, D::MONEY),
                'discount' => D::format((string) $i->discount, D::MONEY),
                'discount_method' => $i->discount_method,
                'discount_amount' => D::format((string) $i->discount_amount, D::MONEY),
                'subtotal' => D::format((string) $i->subtotal, D::MONEY),
            ])->values()->all(),
            'subtotal' => D::format((string) $s->subtotal, D::MONEY),
            'discount' => D::format((string) $s->discount, D::MONEY),
            'tax_amount' => D::format((string) $s->tax_amount, D::MONEY),
            'total' => D::format((string) $s->total, D::MONEY),
            'paid_now' => D::format((string) $s->paid_now, D::MONEY),
            'credit_amount' => D::format((string) $s->credit_amount, D::MONEY),
            'payment_status' => $s->payment_status,
            'status' => $s->status,
            'payments' => $s->payments->map(fn (SalePayment $p) => [
                'id' => $p->id,
                'method' => $p->method ? ['id' => $p->method->id, 'name' => $p->method->name, 'type' => $p->method->type, 'uses_geniuspay' => $p->method->uses_geniuspay] : null,
                'amount' => D::format((string) $p->amount, D::MONEY),
                'cash_given' => D::format($p->cash_given === null ? null : (string) $p->cash_given, D::MONEY),
                'change' => D::format($p->change === null ? null : (string) $p->change, D::MONEY),
                'status' => $p->status,
            ])->values()->all(),
            'credit' => $credit ? [
                'id' => $credit->id,
                'remaining_amount' => D::format((string) $credit->remaining_amount, D::MONEY),
                'repaid_amount' => app(CreditLedger::class)->repaid($credit->id),
                'status' => $credit->status,
            ] : null,
            'note' => $s->note,
            'cancelled_at' => $s->cancelled_at?->toIso8601String(),
            'cancel_reason' => $s->cancel_reason,
            'sync_status' => $s->sync_status,
            'review_reasons' => $s->review_reasons ?? [],
        ];
    }

    public static function listItem(Sale $s): array
    {
        return [
            'id' => $s->id,
            'reference' => $s->reference,
            'customer' => $s->customer ? ['id' => $s->customer->id, 'name' => $s->customer->name, 'phone' => $s->customer->phone] : null,
            'user' => $s->user ? ['id' => $s->user->id, 'name' => $s->user->name()] : null,
            'occurred_at' => $s->occurred_at->toIso8601String(),
            'total' => D::format((string) $s->total, D::MONEY),
            'paid_now' => D::format((string) $s->paid_now, D::MONEY),
            'credit_amount' => D::format((string) $s->credit_amount, D::MONEY),
            'payment_status' => $s->payment_status,
            'status' => $s->status,
            'sync_status' => $s->sync_status,
            'items_count' => (int) $s->items_count,
        ];
    }

    /** Reçu prêt à imprimer ou à partager (ADR-013). */
    public static function receipt(Sale $s): array
    {
        $s->loadMissing('shop');
        $shop = $s->shop;
        $tenant = CurrentTenant::get();

        return [
            'sale' => self::sale($s),
            'shop' => [
                'name' => $shop->name,
                'address' => collect([$shop->address, $shop->district, $shop->city])->filter()->implode(', ') ?: null,
                'phone' => $shop->phone,
                'note' => $shop->receipt_note,
                'show_customer' => $shop->receipt_show_customer,
                'show_phone' => $shop->receipt_show_phone,
            ],
            'tenant' => ['name' => $tenant->name, 'footer' => $tenant->settings?->receipt_footer],
        ];
    }

    /** Soldes d'un lot de clients dans des boutiques, en une requête. @return Collection<int, string> */
    public static function balances(array $customerIds, array $shopIds): Collection
    {
        return DB::table('customer_credits')->whereIn('customer_id', $customerIds)->whereIn('shop_id', $shopIds)
            ->where('status', '!=', 'cancelled')->groupBy('customer_id')
            ->selectRaw('customer_id, sum(remaining_amount) as balance')->pluck('balance', 'customer_id');
    }
}
