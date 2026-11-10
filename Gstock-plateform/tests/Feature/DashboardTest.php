<?php

namespace Tests\Feature;

use App\Domain\Identity\Models\User;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Shops\Models\Shop;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** Tableau de bord (M13, distinction financière §7.8) et journal d'activité (M14). */
class DashboardTest extends TestCase
{
    private Tenant $tenant;

    private Shop $shop;

    private User $owner;

    private int $cash;

    private int $mobile;

    private int $customer;

    private int $rice;

    protected function setUp(): void
    {
        parent::setUp();
        // Midi : les opérations d'un test restent dans la même journée.
        $this->travelTo(now()->setTime(12, 0));
        ['tenant' => $this->tenant, 'owner' => $this->owner, 'shop' => $this->shop] = $this->createTenant();
        [$this->cash, $this->mobile] = $this->tenant->run(fn () => [
            DB::table('payment_methods')->where('type', 'cash')->value('id'),
            DB::table('payment_methods')->where('type', 'mobile_money')->value('id'),
        ]);
        $this->customer = $this->api('kone', 'POST', '/customers', ['name' => 'Awa Koné'], as: $this->owner)->json('data.id');
        $this->rice = $this->api('kone', 'POST', '/products', ['name' => 'Riz', 'price' => '1000', 'cost' => '700', 'stock_alert' => '5', 'initial_quantity' => '20', 'shop_id' => $this->shop->id], as: $this->owner)->json('data.id');
    }

    public function test_a_credit_sale_is_a_sale_and_a_repayment_is_money_in(): void
    {
        // Vente payée : 3 000 en espèces.
        $this->sell('3', [['payment_method_id' => $this->cash, 'amount' => '3000']]);
        // Vente de 5 000 : 1 000 en Mobile Money, 4 000 à crédit.
        $this->travel(1)->minutes();
        $this->sell('5', [['payment_method_id' => $this->mobile, 'amount' => '1000']], $this->customer);
        $this->travel(1)->minutes();
        // Remboursement de 1 500 : de l'argent reçu, pas une vente.
        $this->api('kone', 'POST', $this->url('/repayments'), ['customer_id' => $this->customer, 'amount' => '1500', 'payment_method_id' => $this->cash], as: $this->owner)->assertCreated();
        $this->travel(1)->minutes();
        // Une vente annulée ne compte pas.
        $cancelled = $this->sell('1', [['payment_method_id' => $this->cash, 'amount' => '1000']]);
        $this->api('kone', 'POST', $this->url("/sales/{$cancelled}/cancel"), ['reason' => 'Erreur'], as: $this->owner)->assertOk();
        $this->travel(1)->minutes();
        // Dépense et paiement fournisseur : de l'argent sorti.
        $categoryId = $this->tenant->run(fn () => DB::table('expense_categories')->where('name', 'Transport')->value('id'));
        $this->api('kone', 'POST', $this->url('/expenses'), ['expense_category_id' => $categoryId, 'amount' => '500', 'payment_method_id' => $this->cash], as: $this->owner)->assertCreated();
        $this->travel(1)->minutes();
        $this->api('kone', 'POST', $this->url('/purchases'), ['items' => [['product_id' => $this->rice, 'quantity' => '2', 'cost' => '700']],
            'paid_amount' => '1400', 'payment_method_id' => $this->cash], as: $this->owner)->assertCreated();

        $d = $this->api('kone', 'GET', $this->url('/dashboard?period=today'), as: $this->owner)->assertOk();
        $d->assertJsonPath('data.period.key', 'today')
            ->assertJsonPath('data.sales', ['total' => '8000.00', 'count' => 2, 'paid_now' => '4000.00', 'on_credit' => '4000.00', 'previous_total' => '0.00', 'change_percent' => null])
            ->assertJsonPath('data.money_in.total', '5500.00')->assertJsonPath('data.money_in.from_repayments', '1500.00')
            ->assertJsonPath('data.money_in.by_method.0', ['method' => ['id' => $this->cash, 'name' => 'Espèces'], 'amount' => '4500.00'])
            ->assertJsonPath('data.money_out', ['expenses' => '500.00', 'customer_refunds' => '0.00', 'supplier_payments' => '1400.00'])
            ->assertJsonPath('data.credits', ['remaining' => '2500.00', 'debtors' => 1])
            // 8 000 − 8 × 700 − 500 = 1 900.
            ->assertJsonPath('data.result', ['amount' => '1900.00', 'cost_of_goods' => '5600.00', 'complete' => true]);
        // 20 − 8 + 2 = 14 en stock : ni alerte ni rupture.
        $d->assertJsonPath('data.stock', ['low' => 0, 'out' => 0]);
        $types = collect($d->json('data.recent'))->pluck('type')->all();
        $this->assertSame(['purchase', 'expense', 'sale', 'repayment', 'sale_credit', 'sale'], $types);
        $this->assertTrue($d->json('data.recent.2.cancelled'));
    }

    public function test_previous_period_comparison_incomplete_result_and_alerts(): void
    {
        $this->travelTo(now()->subDay()->setTime(10, 0));
        $this->sell('2', [['payment_method_id' => $this->cash, 'amount' => '2000']]);
        $this->travelTo(now()->addDay()->setTime(12, 0));
        $this->sell('3', [['payment_method_id' => $this->cash, 'amount' => '3000']]);
        // Un produit sans prix d'achat rend le résultat incomplet ; il passe aussi en alerte.
        $soap = $this->api('kone', 'POST', '/products', ['name' => 'Savon', 'price' => '500', 'stock_alert' => '3', 'initial_quantity' => '3', 'shop_id' => $this->shop->id], as: $this->owner)->json('data.id');
        $this->api('kone', 'POST', $this->url('/sales'), ['items' => [['product_id' => $soap, 'quantity' => '3']], 'payments' => [['payment_method_id' => $this->cash, 'amount' => '1500']]], as: $this->owner)->assertCreated();

        $this->api('kone', 'GET', $this->url('/dashboard'), as: $this->owner)
            ->assertJsonPath('data.sales.previous_total', '2000.00')->assertJsonPath('data.sales.change_percent', 125)
            ->assertJsonPath('data.result.complete', false)->assertJsonPath('data.stock', ['low' => 0, 'out' => 1]);
        $this->api('kone', 'GET', $this->url('/dashboard?period=week'), as: $this->owner)->assertJsonPath('data.sales.total', '6500.00')->assertJsonPath('data.sales.count', 3);
    }

    public function test_installments_visibility_and_the_all_shops_view(): void
    {
        $sale = $this->sell('4', [], $this->customer);
        $credit = $this->tenant->run(fn () => DB::table('customer_credits')->where('sale_id', $sale)->value('id'));
        $this->api('kone', 'PUT', $this->url("/credits/{$credit}/installments"), ['installments' => [
            ['due_date' => now()->subDays(2)->toDateString(), 'amount' => '1500'],
            ['due_date' => now()->addDays(3)->toDateString(), 'amount' => '1500'],
            ['due_date' => now()->addDays(20)->toDateString(), 'amount' => '1000'],
        ]], as: $this->owner)->assertOk();
        $this->api('kone', 'GET', $this->url('/dashboard'), as: $this->owner)->assertJsonPath('data.installments', [
            'overdue' => ['count' => 1, 'amount' => '1500.00'], 'upcoming' => ['count' => 1, 'amount' => '1500.00'],
        ]);

        // Sans records.view_all : seulement ses propres ventes ; les crédits restent l'état de la boutique.
        $seller = $this->createUser($this->tenant, ['dashboard.view', 'sales.create'], [$this->shop]);
        $this->api('kone', 'POST', $this->url('/sales'), ['items' => [['product_id' => $this->rice, 'quantity' => '1']], 'payments' => [['payment_method_id' => $this->cash, 'amount' => '1000']]], as: $seller)->assertCreated();
        $this->api('kone', 'GET', $this->url('/dashboard'), as: $seller)
            ->assertJsonPath('data.sales.total', '1000.00')->assertJsonPath('data.credits.remaining', '4000.00')->assertJsonCount(1, 'data.recent');
        $this->api('kone', 'GET', '/dashboard', as: $seller)->assertForbidden();
        $this->api('kone', 'GET', $this->url('/dashboard'), as: $this->createUser($this->tenant, ['sales.create'], [$this->shop]))->assertForbidden();

        // Toutes les boutiques : le propriétaire voit la somme.
        $other = $this->api('kone', 'POST', '/shops', ['name' => 'Boutique Yopougon', 'city' => 'Abidjan'], as: $this->owner)->assertCreated()->json('data.id');
        $this->api('kone', 'POST', "/shops/{$other}/adjustments", ['kind' => 'entry', 'reason' => 'Arrivage', 'items' => [['product_id' => $this->rice, 'quantity' => '5']]], as: $this->owner)->assertCreated();
        $this->api('kone', 'POST', "/shops/{$other}/sales", ['items' => [['product_id' => $this->rice, 'quantity' => '2']], 'payments' => [['payment_method_id' => $this->cash, 'amount' => '2000']]], as: $this->owner)->assertCreated();
        $this->api('kone', 'GET', '/dashboard', as: $this->owner)->assertJsonPath('data.sales.total', '7000.00')->assertJsonPath('data.sales.count', 3);
    }

    public function test_the_sales_trend_and_the_products_to_restock_within_seven_days(): void
    {
        // Il y a 3 jours : 2 riz. Aujourd'hui : 6 riz.
        $this->travelTo(now()->subDays(3)->setTime(10, 0));
        $this->sell('2', [['payment_method_id' => $this->cash, 'amount' => '2000']]);
        $this->travelTo(now()->addDays(3)->setTime(12, 0));
        $this->sell('6', [['payment_method_id' => $this->cash, 'amount' => '6000']]);
        // Pain : 10 + 1 acheté, 9 vendus, 2 restants = 6 jours (9 en 30 jours). Sucre : 13, 9 vendus, 4 restants = 13 jours.
        $product = fn (string $name, string $stock) => $this->api('kone', 'POST', '/products', ['name' => $name, 'price' => '100', 'cost' => '80', 'initial_quantity' => $stock, 'shop_id' => $this->shop->id], as: $this->owner)->json('data.id');
        $bread = $product('Pain', '10');
        $sugar = $product('Sucre', '13');
        $supplier = $this->api('kone', 'POST', '/suppliers', ['name' => 'Boulangerie du Plateau'], as: $this->owner)->json('data.id');
        $this->api('kone', 'POST', $this->url('/purchases'), ['supplier_id' => $supplier, 'items' => [['product_id' => $bread, 'quantity' => '1', 'cost' => '80']]], as: $this->owner)->assertCreated();
        $this->api('kone', 'POST', $this->url('/sales'), ['items' => [['product_id' => $bread, 'quantity' => '9'], ['product_id' => $sugar, 'quantity' => '9']],
            'payments' => [['payment_method_id' => $this->cash, 'amount' => '1800']]], as: $this->owner)->assertCreated();

        $d = $this->api('kone', 'GET', $this->url('/dashboard?period=week'), as: $this->owner)->assertOk();
        // Sept jours, aujourd'hui compris ; les jours sans vente valent 0.
        $d->assertJsonCount(7, 'data.trend')
            ->assertJsonPath('data.trend.0', ['date' => now()->subDays(6)->toDateString(), 'total' => '0.00'])
            ->assertJsonPath('data.trend.3', ['date' => now()->subDays(3)->toDateString(), 'total' => '2000.00'])
            ->assertJsonPath('data.trend.6', ['date' => now()->toDateString(), 'total' => '7800.00']);
        $this->api('kone', 'GET', $this->url('/dashboard?period=month'), as: $this->owner)->assertJsonCount(30, 'data.trend');
        $this->api('kone', 'GET', $this->url('/dashboard'), as: $this->owner)->assertJsonCount(7, 'data.trend');

        // À racheter dans les 7 jours : le pain seulement (le sucre tient 13 jours, le riz 36).
        $d->assertJsonPath('data.restock.horizon_days', 7)->assertJsonPath('data.restock.count', 1)
            ->assertJsonPath('data.restock.items.0.product.id', $bread)->assertJsonPath('data.restock.items.0.days_left', 6)
            ->assertJsonPath('data.restock.items.0.quantity', '2.000')
            ->assertJsonPath('data.restock.items.0.supplier', ['id' => $supplier, 'name' => 'Boulangerie du Plateau']);
        // Le rapport garde son horizon de 14 jours : le sucre y figure.
        $report = $this->api('kone', 'GET', $this->url('/reports/products'), as: $this->owner)->assertOk();
        $this->assertEqualsCanonicalizing([$bread, $sugar], array_column(array_column($report->json('data.restock.items'), 'product'), 'id'));

        // Sans records.view_all : la courbe ne compte que ses ventes ; le rappel reste l'état de la boutique.
        $seller = $this->createUser($this->tenant, ['dashboard.view', 'sales.create'], [$this->shop]);
        $this->api('kone', 'POST', $this->url('/sales'), ['items' => [['product_id' => $this->rice, 'quantity' => '1']], 'payments' => [['payment_method_id' => $this->cash, 'amount' => '1000']]], as: $seller)->assertCreated();
        $this->api('kone', 'GET', $this->url('/dashboard?period=week'), as: $seller)
            ->assertJsonPath('data.trend.3.total', '0.00')->assertJsonPath('data.trend.6.total', '1000.00')->assertJsonPath('data.restock.count', 1);
    }

    public function test_the_activity_log_can_be_searched_by_author(): void
    {
        $sale = $this->sell('1', [['payment_method_id' => $this->cash, 'amount' => '1000']]);
        $this->api('kone', 'POST', $this->url("/sales/{$sale}/cancel"), ['reason' => 'Client parti'], as: $this->owner)->assertOk();
        $name = $this->tenant->run(fn () => $this->owner->fresh()->firstname);

        $this->api('kone', 'GET', '/audit-logs?search='.urlencode($name), as: $this->owner)->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.action', 'sale.cancelled');
        $this->api('kone', 'GET', '/audit-logs?search=parti&filter[domain]=sale', as: $this->owner)->assertJsonPath('data.0.reason', 'Client parti');
        $this->api('kone', 'GET', '/audit-logs?search=personne', as: $this->owner)->assertJsonPath('meta.total', 0);
    }

    private function sell(string $quantity, array $payments, ?int $customer = null): int
    {
        return $this->api('kone', 'POST', $this->url('/sales'), [
            'items' => [['product_id' => $this->rice, 'quantity' => $quantity]], 'payments' => $payments, 'customer_id' => $customer,
        ], as: $this->owner)->assertCreated()->json('data.id');
    }

    private function url(string $path): string
    {
        return "/shops/{$this->shop->id}{$path}";
    }
}
