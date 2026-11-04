<?php

namespace App\Http\Resources;

use App\Domain\Credits\CreditLedger;
use App\Domain\Credits\InstallmentSchedule;
use App\Domain\Credits\Models\CreditAdjustment;
use App\Domain\Credits\Models\CreditRepayment;
use App\Domain\Credits\Models\CreditRepaymentAllocation;
use App\Domain\Credits\Models\CustomerCredit;
use App\Domain\Credits\Models\CustomerRefund;
use App\Domain\Platform\CurrentTenant;
use App\Support\Decimal as D;

/** Formes JSON du module Crédits, identiques à `Gstock-frontend/src/types/credits.ts`. */
final class CreditsPresenter
{
    public function __construct(private CreditLedger $ledger) {}

    /** Fiche d'un crédit : origine, paiements affectés, régularisations, échéances, annulation. */
    public function credit(CustomerCredit $c): array
    {
        $c->loadMissing(['shop', 'customer', 'sale.items.product.variants', 'adjustments.user']);
        $repaid = $this->ledger->repaid($c->id);
        $allocations = CreditRepaymentAllocation::query()->with('repayment')->where('customer_credit_id', $c->id)
            ->whereHas('repayment', fn ($q) => $q->where('status', 'completed'))->orderBy('id')->get();

        return [
            'id' => $c->id,
            'reference' => $c->reference,
            'shop' => ['id' => $c->shop->id, 'name' => $c->shop->name],
            'customer' => ['id' => $c->customer->id, 'name' => $c->customer->name, 'phone' => $c->customer->phone],
            'sale' => $c->sale ? [
                'id' => $c->sale->id,
                'reference' => $c->sale->reference,
                'items' => $c->sale->items->map(fn ($i) => [
                    'name' => $i->product->articleName($i->product_variant_id),
                    'quantity' => D::format((string) $i->quantity),
                    'subtotal' => D::format((string) $i->subtotal, D::MONEY),
                ])->values()->all(),
            ] : null,
            'is_opening_balance' => $c->is_opening_balance,
            'note' => $c->note,
            'amount' => D::format((string) $c->amount, D::MONEY),
            'repaid_amount' => $repaid,
            'adjusted_amount' => $this->ledger->adjusted($c->id),
            'remaining_amount' => D::format((string) $c->remaining_amount, D::MONEY),
            'status' => $c->status,
            'occurred_at' => $c->occurred_at->toIso8601String(),
            'allocations' => $allocations->map(fn ($a) => [
                'repayment' => ['id' => $a->repayment->id, 'reference' => $a->repayment->reference, 'received_at' => $a->repayment->received_at->toIso8601String(), 'status' => $a->repayment->status],
                'credit' => ['id' => $c->id, 'reference' => $c->reference],
                'amount' => D::format((string) $a->amount, D::MONEY),
            ])->values()->all(),
            'adjustments' => $c->adjustments->map(fn (CreditAdjustment $a) => [
                'id' => $a->id, 'amount' => D::format((string) $a->amount, D::MONEY), 'reason' => $a->reason,
                'user' => $a->user ? ['id' => $a->user->id, 'name' => $a->user->name()] : null,
                'created_at' => $a->created_at->toIso8601String(),
            ])->values()->all(),
            'installments' => $c->status === 'cancelled' ? [] : InstallmentSchedule::of('customer_credit', $c->id, (string) $c->remaining_amount),
            'cancelled_at' => $c->cancelled_at?->toIso8601String(),
            'cancel_reason' => $c->cancel_reason,
            'cancel_settlement' => $c->cancel_settlement_mode
                ? ['mode' => $c->cancel_settlement_mode, 'amount' => D::format((string) $c->cancel_settlement_amount, D::MONEY)] : null,
        ];
    }

    public function listItem(CustomerCredit $c): array
    {
        $d = $this->credit($c);

        return array_intersect_key($d, array_flip(['id', 'reference', 'customer', 'sale', 'is_opening_balance', 'amount', 'remaining_amount', 'status', 'occurred_at']));
    }

    /** Paiement RB-N, avec le solde du client dans la boutique (pour le reçu). */
    public function repayment(CreditRepayment $r): array
    {
        $r->loadMissing(['shop', 'customer', 'method', 'user', 'allocations.credit']);

        return [
            'id' => $r->id,
            'reference' => $r->reference,
            'shop' => ['id' => $r->shop->id, 'name' => $r->shop->name],
            'customer' => ['id' => $r->customer->id, 'name' => $r->customer->name, 'phone' => $r->customer->phone],
            'received_at' => $r->received_at->toIso8601String(),
            'amount' => D::format((string) $r->amount, D::MONEY),
            'method' => $r->method ? ['id' => $r->method->id, 'name' => $r->method->name, 'type' => $r->method->type, 'uses_geniuspay' => $r->method->uses_geniuspay] : null,
            'paid_with_credit_note' => $r->payment_method_id === null,
            'allocations' => $r->allocations->map(fn ($a) => [
                'credit' => ['id' => $a->credit->id, 'reference' => $a->credit->reference, 'is_opening_balance' => $a->credit->is_opening_balance],
                'amount' => D::format((string) $a->amount, D::MONEY),
            ])->values()->all(),
            'note' => $r->note,
            'status' => $r->status,
            'user' => $r->user ? ['id' => $r->user->id, 'name' => $r->user->name()] : null,
            'balance_after' => D::format(SalesPresenter::balance($r->customer_id, [$r->shop_id]), D::MONEY),
            'cancelled_at' => $r->cancelled_at?->toIso8601String(),
            'cancel_reason' => $r->cancel_reason,
        ];
    }

    public function refund(CustomerRefund $r): array
    {
        $r->loadMissing(['method', 'credit']);

        return [
            'id' => $r->id,
            'amount' => D::format((string) $r->amount, D::MONEY),
            'method' => ['id' => $r->method->id, 'name' => $r->method->name],
            'reason' => $r->reason,
            'credit' => ['id' => $r->credit->id, 'reference' => $r->credit->reference],
            'created_at' => $r->created_at->toIso8601String(),
        ];
    }

    /** Reçu de paiement prêt à imprimer ou à partager (ADR-013). */
    public function receipt(CreditRepayment $r): array
    {
        $r->loadMissing('shop');
        $shop = $r->shop;
        $tenant = CurrentTenant::get();

        return [
            'repayment' => $this->repayment($r),
            'shop' => [
                'name' => $shop->name,
                'address' => collect([$shop->address, $shop->district, $shop->city])->filter()->implode(', ') ?: null,
                'phone' => $shop->phone,
                'show_phone' => $shop->receipt_show_phone,
            ],
            'tenant' => ['name' => $tenant->name, 'footer' => $tenant->settings?->receipt_footer],
        ];
    }
}
