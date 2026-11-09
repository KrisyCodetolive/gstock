<?php

namespace Tests\Feature;

use App\Domain\Identity\Models\User;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Shops\Models\Shop;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** Rapports, première partie (M15) : ventes jour par jour, produits, à racheter, dormants, accès. */
class ReportsTest extends TestCase
{
    private Tenant $tenant;

    private Shop $shop;

    private User $owner;

    private int $cash;

    protected function setUp(): void
    {
        parent::setUp();
        ['tenant' => $this->tenant, 'owner' => $this->owner, 'shop' => $this->shop] = $this->createTenant();
        $this->cash = $this->tenant->run(fn () => DB::table('payment_methods')->where('type', 'cash')->value('id'));
        $this->travelTo(now()->setTime(12, 0));
    }

    public function test_the_sales_report_gives_totals_average_ticket_margin_and_every_day(): void
    {
        $rice = $this->product('Riz', price: '1000', cost: '700', stock: '100');
        $oil = $this->product('Huile', price: '2000', cost: null, stock: '100');

        $this->travelTo(now()->subDays(3));
        $this->sell([[$rice, '2']]);
        $this->travelBack();
        $this->travelTo(now()->setTime(12, 0));
        $this->sell([[$rice, '1'], [$oil, '1']]);
        $cancelled = $this->sell([[$rice, '5']]);
        $this->api('kone', 'POST', $this->url("/sales/{$cancelled}/cancel"), ['reason' => 'Erreur', 'refund_mode' => 'cash', 'refund_payment_method_id' => $this->cash], as: $this->owner)->assertOk();

        $from = now()->subDays(6)->toDateString();
        $report = $this->api('kone', 'GET', $this->url("/reports/sales?from={$from}&to=".now()->toDateString()), as: $this->owner)->assertOk();
        // Les ventes annulées ne comptent pas (ADR-012).
        $report->assertJsonPath('data.total', '5000.00')->assertJsonPath('data.count', 2)->assertJsonPath('data.average_ticket', '2500.00')
            ->assertJsonPath('data.items_per_sale', '2.0')->assertJsonPath('data.cost_of_goods', '2100.00')->assertJsonPath('data.margin', '2900.00')
            ->assertJsonPath('data.margin_complete', false)->assertJsonPath('data.period.days', 7);
        $days = $report->json('data.days');
        $this->assertCount(7, $days);
        $this->assertSame(['date' => now()->toDateString(), 'total' => '3000.00', 'count' => 1], end($days));
        $this->assertSame('0.00', $days[0]['total']);
        $report->assertJsonPath('data.best_day.date', now()->toDateString())->assertJsonPath('data.worst_day.total', '0.00');

        // Période invalide : message en français.
        $this->api('kone', 'GET', $this->url('/reports/sales?to='.now()->addDay()->toDateString()), as: $this->owner)
            ->assertJsonPath('errors.to.0', 'La période ne peut pas finir dans le futur.');
        $this->api('kone', 'GET', $this->url('/reports/sales?from=2026-02-30'), as: $this->owner)->assertJsonPath('errors.from.0', 'Cette date n’est pas valide.');
        $this->api('kone', 'GET', $this->url('/reports/sales?from=2024-01-01&to='.now()->toDateString()), as: $this->owner)
            ->assertJsonPath('errors.from.0', 'Choisissez une période d’un an au plus.');
    }

    public function test_the_products_report_ranks_products_and_finds_losses_restocks_and_dormant_stock(): void
    {
        // Créés il y a 100 jours : un produit sans vente depuis est dormant.
        $this->travelTo(now()->subDays(100));
        $sleepy = $this->product('Conserve', price: '500', cost: '400', stock: '10');
        $rice = $this->product('Riz', price: '1000', cost: '700', stock: '40');
        $soap = $this->product('Savon', price: '300', cost: '350', stock: '50');
        $this->travelBack();
        $this->travelTo(now()->setTime(12, 0));
        $fresh = $this->product('Nouveau', price: '100', cost: '50', stock: '5');

        // 30 riz vendus sur 30 jours (1 par jour) : 10 en stock, 10 jours restants, 20 à racheter.
        $this->sell([[$rice, '30']]);
        // Vente avec remise globale : le chiffre du produit la reprend au prorata.
        $this->api('kone', 'POST', $this->url('/sales'), ['items' => [['product_id' => $soap, 'quantity' => '10']], 'discount' => '300',
            'payments' => [['payment_method_id' => $this->cash, 'amount' => '2700']]], as: $this->owner)->assertCreated();

        $report = $this->api('kone', 'GET', $this->url('/reports/products'), as: $this->owner)->assertOk();
        $sold = collect($report->json('data.sold'))->keyBy('product.id');
        $this->assertEquals(['revenue' => '30000.00', 'cost' => '21000.00', 'margin' => '9000.00', 'quantity' => '30.000'],
            array_intersect_key($sold[$rice], array_flip(['revenue', 'cost', 'margin', 'quantity'])));
        // Vendu à perte : 2 700 encaissés pour 3 500 de prix d'achat.
        $this->assertEquals(['revenue' => '2700.00', 'margin' => '-800.00'], array_intersect_key($sold[$soap], array_flip(['revenue', 'margin'])));
        $this->assertSame($rice, $report->json('data.sold.0.product.id'));

        // Prix de vente actuel sous le prix d'achat.
        $report->assertJsonPath('data.below_cost.0.product.id', $soap)->assertJsonPath('data.below_cost.0.cost', '350.00')->assertJsonCount(1, 'data.below_cost');

        $report->assertJsonPath('data.restock.items.0.product.id', $rice)->assertJsonPath('data.restock.items.0.days_left', 10)
            ->assertJsonPath('data.restock.items.0.suggested_quantity', '20')->assertJsonPath('data.restock.items.0.per_day', '1.000');
        // Savon : 40 en stock pour 10 vendus en 30 jours, 120 jours : pas à racheter.
        $this->assertNotContains($soap, array_column(array_column($report->json('data.restock.items'), 'product'), 'id'));

        // Dormants à 60 jours : la conserve seulement (le nouveau produit est trop récent).
        $report->assertJsonPath('data.dormant.days', 60)->assertJsonPath('data.dormant.count', 1)->assertJsonPath('data.dormant.value', '4000.00')
            ->assertJsonPath('data.dormant.items.0.product.id', $sleepy)->assertJsonPath('data.dormant.items.0.last_sold_at', null);
        $this->assertNotContains($fresh, array_column(array_column($report->json('data.dormant.items'), 'product'), 'id'));
        $this->api('kone', 'GET', $this->url('/reports/products?dormant_days=45'), as: $this->owner)->assertJsonPath('errors.dormant_days.0', 'Choisissez 30, 60 ou 90 jours.');
    }

    public function test_the_customers_report_ranks_customers_and_follows_debts(): void
    {
        $rice = $this->product('Riz', price: '1000', cost: '600', stock: '100');
        $customer = fn (string $name) => $this->api('kone', 'POST', '/customers', ['name' => $name], as: $this->owner)->json('data.id');
        [$awa, $bakary, $chantal, $didier, $eve] = array_map($customer, ['Awa', 'Bakary', 'Chantal', 'Didier', 'Eve']);
        $sale = fn (?int $who, ?array $payments = null) => $this->api('kone', 'POST', $this->url('/sales'), [
            'customer_id' => $who, 'items' => [['product_id' => $rice, 'quantity' => '1']],
            'payments' => $payments ?? [['payment_method_id' => $this->cash, 'amount' => '1000']],
        ], as: $this->owner)->assertCreated();
        $opening = fn (int $who, string $amount) => $this->api('kone', 'POST', $this->url('/credits/opening-balance'), ['customer_id' => $who, 'amount' => $amount], as: $this->owner)->assertCreated()->json('data.id');
        $repay = fn (int $who, string $amount) => $this->api('kone', 'POST', $this->url('/repayments'), ['customer_id' => $who, 'amount' => $amount, 'payment_method_id' => $this->cash], as: $this->owner)->assertCreated();

        // Il y a 100 jours : Didier, un habitué (3 achats), et Awa (1 achat).
        $this->travelTo(now()->subDays(100));
        $sale($didier);
        $sale($didier);
        $sale($didier);
        $sale($awa);
        // Il y a 70 jours : ancienne dette de Chantal.
        $this->travel(30)->days();
        $opening($chantal, '5000');
        $this->travelBack();
        $this->travelTo(now()->setTime(12, 0));

        $sale($awa);
        $sale($awa);
        $sale($bakary, []);
        $sale(null);
        $repay($bakary, '400');
        $repay($chantal, '1000');
        // Eve : dette du jour, mais une échéance déjà dépassée.
        $credit = $opening($eve, '3000');
        $this->api('kone', 'PUT', $this->url("/credits/{$credit}/installments"), ['installments' => [['due_date' => now()->subDays(3)->toDateString(), 'amount' => '3000']]], as: $this->owner)->assertOk();

        $report = $this->api('kone', 'GET', $this->url('/reports/customers'), as: $this->owner)->assertOk();
        $top = collect($report->json('data.top'))->keyBy('customer.id');
        $this->assertEquals(['visits' => 2, 'revenue' => '2000.00', 'average_basket' => '1000.00', 'margin' => '800.00'],
            array_intersect_key($top[$awa], array_flip(['visits', 'revenue', 'average_basket', 'margin'])));
        $report->assertJsonPath('data.top.0.customer.name', 'Awa')->assertJsonCount(2, 'data.top')
            ->assertJsonPath('data.known_sales', ['count' => 3, 'total' => '3000.00'])->assertJsonPath('data.anonymous_sales', ['count' => 1, 'total' => '1000.00'])
            // Bakary seulement : Awa avait déjà acheté avant la période.
            ->assertJsonPath('data.new_customers', 1)
            ->assertJsonPath('data.lost.count', 1)->assertJsonPath('data.lost.items.0.customer.id', $didier)->assertJsonPath('data.lost.items.0.visits', 3)
            ->assertJsonPath('data.debt_aging.total', '7600.00')
            ->assertJsonPath('data.debt_aging.buckets', [
                ['key' => 'under_30', 'amount' => '3600.00', 'count' => 2],
                ['key' => '30_60', 'amount' => '0.00', 'count' => 0],
                ['key' => 'over_60', 'amount' => '4000.00', 'count' => 1],
            ])
            ->assertJsonPath('data.debt_aging.top.0.customer.id', $chantal)
            // Mis à crédit hors anciennes dettes : 1 000 ; reçu : 1 400 (une ancienne dette payée).
            ->assertJsonPath('data.recovery', ['credited' => '1000.00', 'repaid' => '1400.00', 'rate' => 140]);
        $this->assertEqualsCanonicalizing([$chantal, $eve], array_column(array_column($report->json('data.payers.late'), 'customer'), 'id'));
        $this->assertSame('3000.00', collect($report->json('data.payers.late'))->firstWhere('customer.id', $eve)['overdue']);
        // Chantal a payé mais reste en retard : seul Bakary est un bon payeur.
        $report->assertJsonPath('data.payers.good', [['customer' => ['id' => $bakary, 'name' => 'Bakary', 'phone' => null], 'paid' => '400.00', 'payments' => 1]]);

        $this->api('kone', 'GET', $this->url('/reports/customers?lost_days=90'), as: $this->owner)->assertJsonPath('data.lost.count', 1);
        $this->api('kone', 'GET', $this->url('/reports/customers?lost_days=10'), as: $this->owner)->assertJsonPath('errors.lost_days.0', 'Choisissez 30, 60 ou 90 jours.');
        $this->api('kone', 'GET', '/reports/customers', as: $this->owner)->assertOk()->assertJsonPath('data.new_customers', 1);
    }

    public function test_reports_need_their_permission_and_all_shops_is_for_the_owner(): void
    {
        $manager = $this->createUser($this->tenant, ['dashboard.view', 'records.view_all'], [$this->shop]);
        $this->api('kone', 'GET', $this->url('/reports/sales'), as: $manager)->assertForbidden();

        $analyst = $this->createUser($this->tenant, ['reports.view'], [$this->shop]);
        $this->api('kone', 'GET', $this->url('/reports/sales'), as: $analyst)->assertOk();
        $this->api('kone', 'GET', '/reports/sales', as: $analyst)->assertForbidden();
        $this->api('kone', 'GET', '/reports/products', as: $this->owner)->assertOk()->assertJsonPath('data.period.days', 30);

        // Une boutique d'un autre espace reste inaccessible.
        ['owner' => $stranger] = $this->createTenant('sow', email: 'sow@example.ci', phone: '0700000002');
        $this->api('sow', 'GET', $this->url('/reports/sales'), as: $stranger)->assertNotFound();
    }

    private function product(string $name, string $price, ?string $cost, string $stock): int
    {
        return $this->api('kone', 'POST', '/products', array_filter([
            'name' => $name, 'price' => $price, 'cost' => $cost, 'initial_quantity' => $stock, 'shop_id' => $this->shop->id,
        ], fn ($v) => $v !== null), as: $this->owner)->assertCreated()->json('data.id');
    }

    /** @param  list<array{0: int, 1: string}>  $lines */
    private function sell(array $lines): int
    {
        $quote = $this->api('kone', 'POST', $this->url('/sales/quote'), ['items' => array_map(fn ($l) => ['product_id' => $l[0], 'quantity' => $l[1]], $lines)], as: $this->owner);

        return $this->api('kone', 'POST', $this->url('/sales'), [
            'items' => array_map(fn ($l) => ['product_id' => $l[0], 'quantity' => $l[1]], $lines),
            'payments' => [['payment_method_id' => $this->cash, 'amount' => $quote->json('data.total')]],
        ], as: $this->owner)->assertCreated()->json('data.id');
    }

    private function url(string $path): string
    {
        return "/shops/{$this->shop->id}{$path}";
    }
}
