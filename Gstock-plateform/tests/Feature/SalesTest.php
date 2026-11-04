<?php

namespace Tests\Feature;

use App\Domain\Identity\Models\User;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Shops\Models\Shop;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** Caisse et ventes (M08) : montants du serveur (§7.4), crédit automatique (§7.5), annulation (ADR-012), reçus (ADR-013). */
class SalesTest extends TestCase
{
    private Tenant $tenant;

    private Shop $shop;

    private User $owner;

    private int $rice;

    private int $oil;

    private int $cash;

    private int $momo;

    protected function setUp(): void
    {
        parent::setUp();
        ['tenant' => $this->tenant, 'owner' => $this->owner, 'shop' => $this->shop] = $this->createTenant();
        $this->rice = $this->product('Riz 5 kg', '4500', '10', '3900');
        $this->oil = $this->product('Huile 1 L', '1350', '3', '1150');
        [$this->cash, $this->momo] = $this->tenant->run(fn () => [
            DB::table('payment_methods')->where('type', 'cash')->value('id'),
            DB::table('payment_methods')->where('type', 'mobile_money')->value('id'),
        ]);
    }

    public function test_the_server_computes_every_amount(): void
    {
        $quote = $this->api('kone', 'POST', $this->url('/sales/quote'), [
            'items' => [
                ['product_id' => $this->rice, 'quantity' => '2', 'discount' => '10', 'discount_method' => 'percent'],
                ['product_id' => $this->oil, 'quantity' => '1', 'discount' => '50', 'discount_method' => 'fixed'],
            ],
            'discount' => '100',
            'payments' => [['payment_method_id' => $this->cash, 'amount' => '5000', 'cash_given' => '10000']],
        ], as: $this->owner)->assertOk();

        // Riz : 4500 − 10 % = 4050 × 2 = 8100 ; huile : 1350 − 50 = 1300 ; total lignes 9400 − 100 = 9300.
        $quote->assertJsonPath('data.items.0.discount_amount', '450.00')->assertJsonPath('data.items.0.subtotal', '8100.00')
            ->assertJsonPath('data.subtotal', '9400.00')->assertJsonPath('data.total', '9300.00')
            ->assertJsonPath('data.paid_now', '5000.00')->assertJsonPath('data.change', '5000.00')
            ->assertJsonPath('data.credit_amount', '4300.00')->assertJsonPath('data.payment_status', 'partial');
        // Rien n'est enregistré par un devis.
        $this->assertSame(0, DB::table('sales')->count());
    }

    public function test_a_cash_sale_takes_the_stock_out_and_change_is_never_counted_as_money_received(): void
    {
        $sale = $this->sell([['product_id' => $this->rice, 'quantity' => '2']], [['payment_method_id' => $this->cash, 'amount' => '9000', 'cash_given' => '10000']])
            ->assertCreated()
            ->assertJsonPath('data.reference', 'V-1')->assertJsonPath('data.total', '9000.00')->assertJsonPath('data.paid_now', '9000.00')
            ->assertJsonPath('data.payments.0.change', '1000.00')->assertJsonPath('data.payment_status', 'paid')->assertJsonPath('data.credit', null);
        $this->assertSame('8.000', $this->stock($this->rice));
        $this->assertSame('sale', DB::table('stock_movements')->where('source_id', $sale->json('data.id'))->value('source_type'));
        // Le prix envoyé par le navigateur ne compte pas sans le droit de le modifier ; sans changement, il est ignoré.
        $this->sell([['product_id' => $this->rice, 'quantity' => '1', 'price' => '4500']], [['payment_method_id' => $this->momo, 'amount' => '4500']])->assertCreated();
    }

    public function test_a_remainder_becomes_a_customer_credit(): void
    {
        $customer = $this->api('kone', 'POST', '/customers', ['name' => 'Awa Koné', 'phone' => '07 48 21 90 33'], as: $this->owner)->json('data.id');

        $this->sell([['product_id' => $this->rice, 'quantity' => '1']], [])
            ->assertUnprocessable()->assertJsonPath('errors.customer_id.0', 'Choisissez un client pour mettre à crédit.');
        $sale = $this->sell([['product_id' => $this->rice, 'quantity' => '1']], [['payment_method_id' => $this->cash, 'amount' => '1500']], ['customer_id' => $customer])
            ->assertCreated()->assertJsonPath('data.credit_amount', '3000.00')->assertJsonPath('data.payment_status', 'partial')
            ->assertJsonPath('data.credit.remaining_amount', '3000.00')->assertJsonPath('data.credit.repaid_amount', '0.00');
        $this->assertSame($sale->json('data.reference'), DB::table('customer_credits')->value('reference'));

        $this->api('kone', 'GET', "/customers/{$customer}", as: $this->owner)->assertJsonPath('data.balance', '3000.00');
        $this->api('kone', 'GET', '/customers?filter[has_balance]=true', as: $this->owner)->assertJsonCount(1, 'data');
        $this->api('kone', 'GET', "/customers/{$customer}/summary", as: $this->owner)
            ->assertJsonPath('data.purchases.count', 1)->assertJsonPath('data.credits.0.amount', '3000.00')
            ->assertJsonPath('data.balances.0.balance', '3000.00');
    }

    public function test_permissions_for_credit_price_and_discount_are_checked_by_the_server(): void
    {
        $cashier = $this->createUser($this->tenant, ['sales.create', 'sales.view'], [$this->shop]);
        $customer = $this->api('kone', 'POST', '/customers', ['name' => 'Yao'], as: $this->owner)->json('data.id');

        $this->sell([['product_id' => $this->rice, 'quantity' => '1']], [], ['customer_id' => $customer], $cashier)
            ->assertForbidden()->assertJsonPath('message', "Vous n'avez pas le droit de mettre à crédit.");
        $this->sell([['product_id' => $this->rice, 'quantity' => '1', 'price' => '100']], [['payment_method_id' => $this->cash, 'amount' => '100']], as: $cashier)
            ->assertForbidden()->assertJsonPath('message', "Vous n'avez pas le droit de modifier un prix.");
        $this->sell([['product_id' => $this->rice, 'quantity' => '1', 'discount' => '500']], [], as: $cashier)
            ->assertForbidden()->assertJsonPath('message', "Vous n'avez pas le droit de faire une remise.");
        $this->assertSame(0, DB::table('sales')->count());

        // Le propriétaire peut changer un prix : l'action est journalisée (M14).
        $this->sell([['product_id' => $this->rice, 'quantity' => '1', 'price' => '4000']], [['payment_method_id' => $this->cash, 'amount' => '4000']])->assertCreated();
        $this->assertTrue(DB::table('audit_logs')->where('action', 'sale.price_changed')->exists());
    }

    public function test_a_sale_is_refused_whole_when_the_stock_is_short(): void
    {
        $this->sell([['product_id' => $this->rice, 'quantity' => '1'], ['product_id' => $this->oil, 'quantity' => '4']], [['payment_method_id' => $this->cash, 'amount' => '9900']])
            ->assertUnprocessable()->assertJsonPath('message', 'Stock insuffisant : il reste 3 u de Huile 1 L.');
        $this->assertSame('10.000', $this->stock($this->rice));
        $this->assertSame(0, DB::table('sales')->count());
        $this->sell([], [])->assertJsonPath('errors.items.0', 'Le panier est vide.');
        $this->sell([['product_id' => $this->rice, 'quantity' => '1']], [['payment_method_id' => $this->cash, 'amount' => '5000']])
            ->assertJsonPath('errors.payments.0', 'L’argent reçu dépasse le total : saisissez le rendu en espèces.');
        // Le numéro V-1 n'a pas été consommé par les refus.
        $this->sell([['product_id' => $this->rice, 'quantity' => '1']], [['payment_method_id' => $this->cash, 'amount' => '4500']])->assertJsonPath('data.reference', 'V-1');
    }

    public function test_an_offline_sale_is_recorded_once(): void
    {
        $extra = ['offline_uuid' => '7c9e6679-7425-40de-944b-e07fc1f90ae7'];
        $first = $this->sell([['product_id' => $this->rice, 'quantity' => '1']], [['payment_method_id' => $this->cash, 'amount' => '4500']], $extra)->assertCreated();
        $this->sell([['product_id' => $this->rice, 'quantity' => '1']], [['payment_method_id' => $this->cash, 'amount' => '4500']], $extra)
            ->assertOk()->assertJsonPath('data.id', $first->json('data.id'));
        $this->assertSame('9.000', $this->stock($this->rice));
    }

    public function test_cancelling_a_sale_gives_the_stock_back_and_cancels_its_credit(): void
    {
        $customer = $this->api('kone', 'POST', '/customers', ['name' => 'Awa'], as: $this->owner)->json('data.id');
        $id = $this->sell([['product_id' => $this->rice, 'quantity' => '3']], [], ['customer_id' => $customer])->json('data.id');
        $this->assertSame('7.000', $this->stock($this->rice));

        $this->api('kone', 'POST', $this->url("/sales/{$id}/cancel"), ['reason' => ''], as: $this->owner)
            ->assertJsonPath('errors.reason.0', 'Indiquez pourquoi vous annulez cette vente.');
        $this->api('kone', 'POST', $this->url("/sales/{$id}/cancel"), ['reason' => 'Erreur de caisse'], as: $this->owner)
            ->assertOk()->assertJsonPath('data.status', 'cancelled')->assertJsonPath('data.cancel_reason', 'Erreur de caisse')
            ->assertJsonPath('data.credit.status', 'cancelled');
        $this->assertSame('10.000', $this->stock($this->rice));
        $this->api('kone', 'GET', "/customers/{$customer}", as: $this->owner)->assertJsonPath('data.balance', '0.00');
        $this->api('kone', 'POST', $this->url("/sales/{$id}/cancel"), ['reason' => 'Encore'], as: $this->owner)
            ->assertStatus(409)->assertJsonPath('message', 'Cette vente a déjà été annulée.');
        $this->assertTrue(DB::table('audit_logs')->where('action', 'sale.cancelled')->exists());
    }

    public function test_history_summary_and_visibility(): void
    {
        $seller = $this->createUser($this->tenant, ['sales.create', 'sales.view'], [$this->shop]);
        $this->sell([['product_id' => $this->rice, 'quantity' => '1']], [['payment_method_id' => $this->cash, 'amount' => '4500']]);
        $mine = $this->sell([['product_id' => $this->oil, 'quantity' => '1']], [['payment_method_id' => $this->cash, 'amount' => '1350']], as: $seller)->json('data.id');
        $cancelled = $this->sell([['product_id' => $this->oil, 'quantity' => '1']], [['payment_method_id' => $this->cash, 'amount' => '1350']])->json('data.id');
        $this->api('kone', 'POST', $this->url("/sales/{$cancelled}/cancel"), ['reason' => 'Test'], as: $this->owner);

        $this->api('kone', 'GET', $this->url('/sales'), as: $this->owner)->assertJsonPath('meta.total', 3)
            ->assertJsonPath('summary', ['count' => 2, 'total' => '5850.00', 'paid_now' => '5850.00', 'credit_amount' => '0.00'])
            ->assertJsonPath('data.0.items_count', 1);
        $this->api('kone', 'GET', $this->url('/sales?search=V-2'), as: $this->owner)->assertJsonPath('meta.total', 1);
        $this->api('kone', 'GET', $this->url('/sales?filter[status]=cancelled'), as: $this->owner)->assertJsonPath('meta.total', 1);

        // Sans records.view_all, seulement ses propres ventes (§6.2).
        $this->assertSame([$mine], array_column($this->api('kone', 'GET', $this->url('/sales'), as: $seller)->json('data'), 'id'));
        $this->api('kone', 'GET', $this->url("/sales/{$cancelled}"), as: $seller)->assertNotFound();
    }

    public function test_receipts_are_shared_by_a_signed_link_that_expires(): void
    {
        $id = $this->sell([['product_id' => $this->rice, 'quantity' => '1']], [['payment_method_id' => $this->cash, 'amount' => '4500']])->json('data.id');
        $this->api('kone', 'GET', $this->url("/sales/{$id}/receipt"), as: $this->owner)->assertJsonPath('data.shop.name', 'Boutique principale')->assertJsonPath('data.sale.id', $id);

        $link = $this->api('kone', 'POST', $this->url("/sales/{$id}/share-link"), as: $this->owner)->assertOk()->json('data');
        $this->assertStringStartsWith('http://kone.localhost:5173/recu/', $link['url']);
        $this->assertSame("Bonjour, voici votre reçu V-1 de Kone (4500 FCFA) : {$link['url']}", $link['message']);
        $token = substr($link['url'], strrpos($link['url'], '/') + 1);

        $this->app['auth']->forgetGuards();
        $this->api('kone', 'GET', "/public/receipts/{$token}")->assertOk()->assertJsonPath('data.kind', 'sale')->assertJsonPath('data.sale.reference', 'V-1');
        $this->api('kone', 'GET', '/public/receipts/'.substr($token, 0, -3).'abc')->assertNotFound()->assertJsonPath('message', 'Ce lien de reçu n’est pas valide.');
        // Un lien d'un espace ne vaut rien sur un autre.
        $this->createTenant('diallo', email: 'b@example.ci');
        $this->api('diallo', 'GET', "/public/receipts/{$token}")->assertNotFound();
        $this->travel(8)->days();
        $this->api('kone', 'GET', "/public/receipts/{$token}")->assertStatus(410);
    }

    public function test_variants_and_the_pos_bootstrap(): void
    {
        $juice = $this->api('kone', 'POST', '/products', ['name' => 'Jus 1 L', 'type' => 'variable', 'variants' => [['name' => 'Bissap', 'price' => '900'], ['name' => 'Ananas', 'price' => '1000']]], as: $this->owner)->json('data');
        $bissap = $juice['variants'][0]['id'];
        $this->api('kone', 'POST', $this->url('/adjustments'), ['kind' => 'entry', 'reason' => 'Arrivage', 'items' => [['product_id' => $juice['id'], 'variant_id' => $bissap, 'quantity' => '5']]], as: $this->owner);

        $this->sell([['product_id' => $juice['id'], 'quantity' => '1']], [])->assertJsonPath('errors.items.0', 'Choisissez la variante de Jus 1 L.');
        $this->sell([['product_id' => $juice['id'], 'variant_id' => $bissap, 'quantity' => '2']], [['payment_method_id' => $this->cash, 'amount' => '1800']])
            ->assertCreated()->assertJsonPath('data.items.0.product.name', 'Jus 1 L — Bissap')->assertJsonPath('data.items.0.variant.name', 'Bissap');

        $boot = $this->api('kone', 'GET', $this->url('/pos/bootstrap'), as: $this->owner)->assertOk()->json('data');
        $this->assertContains('Jus 1 L — Bissap', array_column($boot['products'], 'name'));
        $this->assertSame('3.000', collect($boot['products'])->firstWhere('variant_id', $bissap)['quantity']);
        $this->assertSame(['Espèces', 'Mobile Money', 'Carte bancaire'], array_column($boot['payment_methods'], 'name'));
    }

    private function product(string $name, string $price, string $stock, string $cost): int
    {
        return $this->api('kone', 'POST', '/products', ['name' => $name, 'price' => $price, 'cost' => $cost, 'initial_quantity' => $stock, 'shop_id' => $this->shop->id], as: $this->owner)->json('data.id');
    }

    private function sell(array $items, array $payments, array $extra = [], ?User $as = null)
    {
        return $this->api('kone', 'POST', $this->url('/sales'), ['items' => $items, 'payments' => $payments, ...$extra], as: $as ?? $this->owner);
    }

    private function url(string $path): string
    {
        return "/shops/{$this->shop->id}{$path}";
    }

    private function stock(int $productId): string
    {
        return (string) DB::table('shop_stock')->where('shop_id', $this->shop->id)->where('product_id', $productId)->value('quantity');
    }
}
