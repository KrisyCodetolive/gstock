<?php

namespace App\Domain\Sales;

use App\Support\Decimal as D;

/** Résultat du calcul d'une vente (§7.4, §7.5). Montants en chaînes décimales à 2 chiffres. */
final class SaleComputation
{
    public function __construct(
        /** @var list<array> lignes avec leur article, prix, remise, taxe, sous-total */
        public readonly array $items,
        public readonly string $subtotal,
        public readonly string $discount,
        public readonly string $taxAmount,
        public readonly string $total,
        /** @var list<array> paiements : mode (ou avoir), montant, somme donnée, rendu */
        public readonly array $payments,
        public readonly string $paidNow,
        public readonly string $change,
        public readonly string $creditAmount,
        /** paid | partial | credit */
        public readonly string $paymentStatus,
        /** @var list<string> écarts de prix d'une vente faite hors ligne */
        public readonly array $priceChanges,
    ) {}

    /** Réponse de POST /sales/quote (`SaleQuote` du frontend). */
    public function quote(): array
    {
        return [
            'items' => array_map(fn ($i) => [
                'product_id' => $i['article']->product->id,
                'variant_id' => $i['article']->variantId(),
                'quantity' => $i['quantity'],
                'price' => $i['price'],
                'discount_amount' => $i['discount_amount'],
                'subtotal' => $i['subtotal'],
            ], $this->items),
            'subtotal' => $this->subtotal,
            'discount' => $this->discount,
            'tax_amount' => $this->taxAmount,
            'total' => $this->total,
            'paid_now' => $this->paidNow,
            'credit_amount' => $this->creditAmount,
            'change' => D::format($this->change, D::MONEY),
            'payment_status' => $this->paymentStatus,
        ];
    }
}
