<?php

namespace App\Domain\Sales;

use App\Domain\Catalog\Article;
use App\Domain\Catalog\Models\Product;
use App\Domain\Identity\Models\User;
use App\Domain\Sales\Models\PaymentMethod;
use App\Support\ApiException;
use App\Support\Decimal as D;

/**
 * Montants d'une vente, toujours recalculés par le serveur (§7.4, §7.5) : ceux
 * envoyés par le navigateur sont ignorés. Sert au devis de la caisse et à l'enregistrement.
 *
 * Par ligne : remise (pourcentage ou montant fixe par unité), taxe exclusive
 * (mode avancé), sous-total = quantité × (prix remisé + taxe). Puis remise
 * globale, paiements, rendu sur les espèces, reste à crédit.
 */
final class SaleCalculator
{
    /**
     * @param  array{items?: array, discount?: mixed, payments?: array}  $input
     * @param  bool  $offline  vente faite sans réseau au prix connu de l'appareil (ADR-005)
     */
    public function compute(array $input, User $user, bool $offline = false): SaleComputation
    {
        $errors = [];
        $add = function (string $field, string $message) use (&$errors) {
            $errors[$field][] = $message;
        };
        $priceChanges = [];
        $lines = array_values((array) ($input['items'] ?? []));
        if (! $lines) {
            $add('items', 'Le panier est vide.');
        }

        $products = Product::query()->with(['variants', 'unit'])->where('is_active', true)
            ->whereKey(array_map(fn ($l) => (int) ($l['product_id'] ?? 0), $lines))->get()->keyBy('id');

        $items = [];
        foreach ($lines as $line) {
            $product = $products->get((int) ($line['product_id'] ?? 0));
            if (! $product) {
                $add('items', 'Un produit du panier n’est plus disponible.');

                continue;
            }
            try {
                $article = Article::resolve($product, $line['variant_id'] ?? null);
            } catch (ApiException $e) {
                $add('items', $e->errors['items'][0]);

                continue;
            }
            $name = $article->name();
            $quantity = D::parse($line['quantity'] ?? null);
            if ($quantity === null || D::cmp($quantity, '0') <= 0) {
                $add('items', "Quantité invalide pour {$name}.");

                continue;
            }

            $catalogPrice = D::format($article->price(), D::MONEY);
            $price = $catalogPrice;
            $sent = D::parse($line['price'] ?? null);
            if (array_key_exists('price', $line) && $line['price'] !== null && ($sent === null || D::cmp($sent, $catalogPrice) !== 0)) {
                if ($offline && $sent !== null) {
                    // Vendu hors ligne au prix de l'appareil : on garde ce prix, l'écart est signalé.
                    $price = D::format($sent, D::MONEY);
                    $priceChanges[] = sprintf("Prix de %s : %s FCFA sur l'appareil, %s FCFA aujourd'hui.", $name, self::fcfa($price), self::fcfa($catalogPrice));
                } else {
                    if (! $user->hasAnyPermission('sales.edit_price')) {
                        throw ApiException::forbidden("Vous n'avez pas le droit de modifier un prix.");
                    }
                    if ($sent === null || D::cmp($sent, '0') < 0) {
                        $add('items', "Prix invalide pour {$name}.");

                        continue;
                    }
                    $price = D::format($sent, D::MONEY);
                }
            }

            $discount = D::parse($line['discount'] ?? null) ?? '0';
            $method = D::cmp($discount, '0') > 0 ? (($line['discount_method'] ?? 'fixed') === 'percent' ? 'percent' : 'fixed') : null;
            if ($method && ! $user->hasAnyPermission('sales.give_discount')) {
                throw ApiException::forbidden("Vous n'avez pas le droit de faire une remise.");
            }
            $discountAmount = match ($method) {
                'percent' => D::div(D::mul($price, D::min($discount, '100'), 6), '100', D::MONEY),
                'fixed' => D::format(D::min($discount, $price), D::MONEY),
                default => '0.00',
            };
            $discounted = D::sub($price, $discountAmount, D::MONEY);
            // Taxe exclusive, option avancée (désactivée par défaut).
            $taxRate = $product->tax_rate === null ? null : (string) $product->tax_rate;
            $unitTax = $taxRate ? D::div(D::mul($discounted, $taxRate, 6), '100', D::MONEY) : '0.00';

            $items[] = [
                'article' => $article,
                'quantity' => D::format($quantity),
                'price' => $price,
                'catalog_price' => $catalogPrice,
                'discount' => D::format($discount, D::MONEY),
                'discount_method' => $method,
                'discount_amount' => $discountAmount,
                'tax_rate' => $taxRate,
                'tax_amount' => D::mul($unitTax, $quantity, D::MONEY),
                'unit_cost' => $article->cost(),
                'subtotal' => D::mul($quantity, D::add($discounted, $unitTax, D::MONEY), D::MONEY),
            ];
        }

        $totalLines = array_reduce($items, fn ($s, $i) => D::add($s, $i['subtotal'], D::MONEY), '0.00');
        $globalDiscount = D::parse($input['discount'] ?? null) ?? '0';
        if (D::cmp($globalDiscount, '0') > 0 && ! $user->hasAnyPermission('sales.give_discount')) {
            throw ApiException::forbidden("Vous n'avez pas le droit de faire une remise.");
        }
        if (D::cmp($globalDiscount, '0') < 0 || D::cmp($globalDiscount, $totalLines) > 0) {
            $add('discount', 'La remise ne peut pas dépasser le total.');
        }
        $discount = D::cmp($globalDiscount, '0') < 0 ? '0.00' : D::format(D::min($globalDiscount, $totalLines), D::MONEY);
        $total = D::sub($totalLines, $discount, D::MONEY);

        $methods = PaymentMethod::query()->where('is_active', true)->get()->keyBy('id');
        $payments = [];
        foreach ((array) ($input['payments'] ?? []) as $p) {
            $creditNote = ! empty($p['credit_note']);
            $method = $creditNote ? null : $methods->get((int) ($p['payment_method_id'] ?? 0));
            if (! $creditNote && ! $method) {
                $add('payments', 'Ce mode de paiement n’est pas disponible.');
            }
            $amount = D::format(D::parse($p['amount'] ?? null) ?? '0', D::MONEY);
            if (D::cmp($amount, '0') <= 0) {
                $add('payments', 'Saisissez un montant supérieur à 0.');
            }
            $given = $method?->type === 'cash' && filled($p['cash_given'] ?? null) ? D::format(D::parse($p['cash_given']) ?? '0', D::MONEY) : null;
            if ($given !== null && D::cmp($given, $amount) < 0) {
                $add('payments', 'La somme donnée est inférieure au montant payé en espèces.');
            }
            $payments[] = [
                'method' => $method,
                'credit_note' => $creditNote,
                'amount' => $amount,
                'cash_given' => $given,
                'change' => $given !== null ? D::sub($given, $amount, D::MONEY) : null,
            ];
        }
        $paidNow = array_reduce($payments, fn ($s, $p) => D::add($s, $p['amount'], D::MONEY), '0.00');
        if (D::cmp($paidNow, $total) > 0) {
            $add('payments', 'L’argent reçu dépasse le total : saisissez le rendu en espèces.');
        }
        if ($errors) {
            throw new ApiException(422, 'Les informations saisies ne sont pas valides.', $errors);
        }

        // Montant à crédit = total − payé immédiatement (§7.5).
        $credit = D::sub($total, $paidNow, D::MONEY);

        return new SaleComputation(
            items: $items,
            subtotal: $totalLines,
            discount: $discount,
            taxAmount: array_reduce($items, fn ($s, $i) => D::add($s, $i['tax_amount'], D::MONEY), '0.00'),
            total: $total,
            payments: $payments,
            paidNow: $paidNow,
            change: array_reduce($payments, fn ($s, $p) => D::add($s, $p['change'] ?? '0', D::MONEY), '0.00'),
            creditAmount: $credit,
            paymentStatus: D::cmp($credit, '0') === 0 ? 'paid' : (D::cmp($paidNow, '0') === 0 ? 'credit' : 'partial'),
            priceChanges: $priceChanges,
        );
    }

    /** « 4500 », « 1250,5 » : montant lisible, sans décimales inutiles. */
    public static function fcfa(string $amount): string
    {
        return D::human($amount);
    }
}
