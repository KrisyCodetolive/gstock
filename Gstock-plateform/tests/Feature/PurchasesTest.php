<?php

namespace Tests\Feature;

use App\Domain\Identity\Models\User;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Shops\Models\Shop;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** Approvisionnements AP-N et fournisseurs (M11, §7.2-7.4, §7.7). */
class PurchasesTest extends TestCase
{
    private Tenant $tenant;

    private Shop $shop;

    private User $owner;

    private int $water;

    private int $soap;

    private int $cash;

    private int $carton;

    private int $supplier;

    protected function setUp(): void
    {
        parent::setUp();
        ['tenant' => $this->tenant, 'owner' => $this->owner, 'shop' => $this->shop] = $this->createTenant();
        [$this->cash, $this->carton] = $this->tenant->run(fn () => [
            DB::table('payment_methods')->where('type', 'cash')->value('id'),
            DB::table('units')->where('name', 'Carton')->value('id'),
        ]);
        $this->water = $this->api('kone', 'POST', '/products', ['name' => 'Eau 1,5 L', 'price' => '400', 'cost' => '300'], as: $this->owner)->json('data.id');
        $this->soap = $this->api('kone', 'POST', '/products', ['name' => 'Savon', 'price' => '500', 'cost' => '350'], as: $this->owner)->json('data.id');
        $this->supplier = $this->api('kone', 'POST', '/suppliers', ['name' => 'Grossiste Adjamé', 'phone' => '0101020304'], as: $this->owner)->assertCreated()->json('data.id');
    }

    public function test_a_purchase_adds_base_units_to_stock_and_can_update_costs(): void
    {
        $lines = [['product_id' => $this->water, 'quantity' => '2', 'cost' => '3000', 'unit_id' => $this->carton], ['product_id' => $this->soap, 'quantity' => '10', 'cost' => '340']];
        $this->api('kone', 'POST', $this->url('/purchases/quote'), ['items' => $lines, 'discount' => '400'], as: $this->owner)->assertOk()
            ->assertJsonPath('data.items.0.base_quantity', '24.000')->assertJsonPath('data.items.0.unit.short_name', 'ctn')
            ->assertJsonPath('data.subtotal', '9400.00')->assertJsonPath('data.total', '9000.00');

        $p = $this->api('kone', 'POST', $this->url('/purchases'), ['items' => $lines, 'discount' => '400', 'supplier_id' => $this->supplier,
            'paid_amount' => '4000', 'payment_method_id' => $this->cash, 'update_costs' => true], as: $this->owner)->assertCreated();
        $p->assertJsonPath('data.reference', 'AP-1')->assertJsonPath('data.total', '9000.00')->assertJsonPath('data.paid_amount', '4000.00')
            ->assertJsonPath('data.due_amount', '5000.00')->assertJsonPath('data.payment_status', 'partial')->assertJsonPath('data.items.0.quantity', '2.000')
            ->assertJsonPath('data.payments.0.method.name', 'Espèces');

        $this->assertSame('24.000', $this->stock($this->water));
        $this->assertSame('10.000', $this->stock($this->soap));
        // Prix d'achat tenu par unité de base : 3 000 le carton de 12 → 250.
        $this->api('kone', 'GET', "/products/{$this->water}", as: $this->owner)->assertJsonPath('data.cost', '250.00');
        $this->assertSame('purchase', $this->tenant->run(fn () => DB::table('stock_movements')->where('product_id', $this->water)->value('source_type')));
    }

    public function test_purchase_validation_messages(): void
    {
        $post = fn (array $body) => $this->api('kone', 'POST', $this->url('/purchases'), $body, as: $this->owner);
        $gram = $this->tenant->run(fn () => DB::table('units')->where('name', 'Gramme')->value('id'));
        $service = $this->api('kone', 'POST', '/products', ['name' => 'Livraison', 'type' => 'service', 'price' => '500'], as: $this->owner)->json('data.id');

        $post(['items' => []])->assertJsonPath('errors.items.0', 'Ajoutez au moins un produit.');
        $post(['items' => [['product_id' => $this->water, 'quantity' => '1', 'cost' => '1', 'unit_id' => $gram]]])->assertJsonPath('errors.items.0', 'Cette unité ne convient pas pour Eau 1,5 L.');
        $post(['items' => [['product_id' => $service, 'quantity' => '1', 'cost' => '1']]])->assertJsonPath('errors.items.0', 'Un des produits ne peut pas être approvisionné.');
        $post(['items' => [['product_id' => $this->water, 'quantity' => '0', 'cost' => '300']]])->assertJsonPath('errors.items.0', 'Saisissez une quantité supérieure à 0 pour Eau 1,5 L.');
        $post(['items' => [['product_id' => $this->water, 'quantity' => '1', 'cost' => '300']], 'discount' => '500'])->assertJsonPath('errors.discount.0', 'La remise ne peut pas dépasser le total.');
        $post(['items' => [['product_id' => $this->water, 'quantity' => '1', 'cost' => '300']], 'paid_amount' => '500', 'payment_method_id' => $this->cash])
            ->assertJsonPath('errors.paid_amount.0', 'Il ne reste que 300 FCFA à payer.');
        $post(['items' => [['product_id' => $this->water, 'quantity' => '1', 'cost' => '300']], 'supplier_id' => 999])->assertJsonPath('errors.supplier_id.0', 'Ce fournisseur n’existe pas.');
        // Rien n'est écrit, pas même un numéro.
        $this->assertSame('0.000', $this->stock($this->water));
        $this->api('kone', 'POST', $this->url('/purchases'), ['items' => [['product_id' => $this->water, 'quantity' => '1', 'cost' => '300']]], as: $this->owner)->assertJsonPath('data.reference', 'AP-1');
    }

    public function test_supplier_payments_never_exceed_the_debt_and_follow_the_schedule(): void
    {
        $id = $this->purchase('10', '1000')->json('data.id'); // 10 000 FCFA, rien de payé.
        $pay = fn (string $amount) => $this->api('kone', 'POST', $this->url("/purchases/{$id}/payments"), ['amount' => $amount, 'payment_method_id' => $this->cash], as: $this->owner);
        $schedule = fn (array $items) => $this->api('kone', 'PUT', $this->url("/purchases/{$id}/installments"), ['installments' => $items], as: $this->owner);

        $schedule([['due_date' => now()->subDays(2)->toDateString(), 'amount' => '4000'], ['due_date' => now()->addDays(8)->toDateString(), 'amount' => '6000']])
            ->assertOk()->assertJsonPath('data.installments.0.status', 'overdue')->assertJsonPath('data.payment_status', 'unpaid');
        $this->api('kone', 'GET', $this->url('/purchases?filter[overdue]=true'), as: $this->owner)
            ->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.overdue_amount', '4000.00');

        $pay('12000')->assertJsonPath('errors.paid_amount.0', "Il ne reste que 10\u{202F}000 FCFA à payer.");
        $pay('5000')->assertOk()->assertJsonPath('data.payment_status', 'partial')->assertJsonPath('data.due_amount', '5000.00')
            ->assertJsonPath('data.installments.0.status', 'paid')->assertJsonPath('data.installments.1.paid_amount', '1000.00');
        $this->api('kone', 'GET', $this->url('/purchases?filter[overdue]=true'), as: $this->owner)->assertJsonPath('meta.total', 0);
        $pay('5000')->assertJsonPath('data.payment_status', 'paid')->assertJsonPath('data.due_amount', '0.00');
        $schedule([['due_date' => now()->toDateString(), 'amount' => '1']])->assertStatus(409);
        $this->api('kone', 'GET', "/suppliers/{$this->supplier}", as: $this->owner)
            ->assertJsonPath('data.purchased_total', '10000.00')->assertJsonPath('data.paid_total', '10000.00')->assertJsonPath('data.due_total', '0.00');
    }

    public function test_cancelling_a_purchase_takes_the_goods_back_but_never_below_zero(): void
    {
        $id = $this->purchase('10', '300')->json('data.id');
        $this->api('kone', 'POST', $this->url('/sales'), ['items' => [['product_id' => $this->water, 'quantity' => '4']],
            'payments' => [['payment_method_id' => $this->cash, 'amount' => '1600']]], as: $this->owner)->assertCreated();

        $this->api('kone', 'POST', $this->url("/purchases/{$id}/cancel"), ['reason' => ''], as: $this->owner)
            ->assertJsonPath('errors.reason.0', 'Indiquez pourquoi vous annulez cet approvisionnement.');
        // 6 en stock, 10 à retirer : refusé, rien ne change (§7.2).
        $this->api('kone', 'POST', $this->url("/purchases/{$id}/cancel"), ['reason' => 'Erreur'], as: $this->owner)
            ->assertUnprocessable()->assertJsonPath('message', 'Stock insuffisant : il reste 6 u de Eau 1,5 L.');
        $this->assertSame('6.000', $this->stock($this->water));

        $other = $this->purchase('5', '300')->json('data.id');
        $this->api('kone', 'POST', $this->url("/purchases/{$other}/cancel"), ['reason' => 'Mauvaise livraison'], as: $this->owner)
            ->assertOk()->assertJsonPath('data.status', 'cancelled')->assertJsonPath('data.due_amount', '0.00')->assertJsonPath('data.cancel_reason', 'Mauvaise livraison');
        $this->assertSame('6.000', $this->stock($this->water));
        $this->api('kone', 'POST', $this->url("/purchases/{$other}/cancel"), ['reason' => 'Encore'], as: $this->owner)->assertStatus(409);
        $this->api('kone', 'POST', $this->url("/purchases/{$other}/payments"), ['amount' => '1', 'payment_method_id' => $this->cash], as: $this->owner)->assertStatus(409);
        $this->assertTrue($this->tenant->run(fn () => DB::table('audit_logs')->where('action', 'purchase.cancelled')->exists()));
    }

    public function test_list_summary_visibility_and_suppliers(): void
    {
        $this->purchase('10', '1000');
        $this->purchase('2', '1000', paid: '2000');
        $keeper = $this->createUser($this->tenant, ['purchases.view', 'purchases.create'], [$this->shop]);
        $this->api('kone', 'POST', $this->url('/purchases'), ['items' => [['product_id' => $this->soap, 'quantity' => '1', 'cost' => '350']]], as: $keeper)->assertCreated();

        $this->api('kone', 'GET', $this->url('/purchases'), as: $this->owner)->assertJsonPath('meta.total', 3)
            ->assertJsonPath('summary', ['count' => 3, 'total' => '12350.00', 'paid' => '2000.00', 'due' => '10350.00']);
        $this->api('kone', 'GET', $this->url('/purchases?filter[payment_status]=paid'), as: $this->owner)->assertJsonPath('meta.total', 1);
        $this->api('kone', 'GET', $this->url('/purchases?search=adjam'), as: $this->owner)->assertJsonPath('meta.total', 2);
        // Sans records.view_all, seulement ses propres approvisionnements (§6.2).
        $this->api('kone', 'GET', $this->url('/purchases'), as: $keeper)->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.items_count', 1);

        // L'écran d'approvisionnement lit les fournisseurs, sans pouvoir les gérer.
        $this->api('kone', 'GET', '/suppliers?filter[has_due]=true', as: $keeper)->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.due_total', '10000.00');
        $this->api('kone', 'POST', '/suppliers', ['name' => 'Autre'], as: $keeper)->assertForbidden();
        $this->api('kone', 'POST', '/suppliers', ['name' => 'grossiste adjame'], as: $this->owner)->assertJsonPath('errors.name.0', 'Un autre fournisseur porte déjà ce nom.');
        $this->api('kone', 'POST', '/suppliers', ['name' => ' '], as: $this->owner)->assertJsonPath('errors.name.0', 'Saisissez le nom du fournisseur.');
        $this->api('kone', 'PUT', "/suppliers/{$this->supplier}", ['name' => 'Grossiste Adjamé', 'is_active' => false], as: $this->owner)->assertJsonPath('data.is_active', false);
        $this->api('kone', 'POST', $this->url('/purchases'), ['supplier_id' => $this->supplier, 'items' => [['product_id' => $this->soap, 'quantity' => '1', 'cost' => '1']]], as: $this->owner)
            ->assertJsonPath('errors.supplier_id.0', 'Ce fournisseur n’existe pas.');
    }

    public function test_a_supplier_can_be_assigned_later_but_never_replaced(): void
    {
        $line = ['items' => [['product_id' => $this->water, 'quantity' => '10', 'cost' => '300']], 'paid_amount' => '1000', 'payment_method_id' => $this->cash];
        $id = $this->api('kone', 'POST', $this->url('/purchases'), $line, as: $this->owner)->assertCreated()->assertJsonPath('data.supplier', null)->json('data.id');
        $assign = fn (int $purchase, mixed $supplier, ?User $as = null) => $this->api('kone', 'PUT', $this->url("/purchases/{$purchase}/supplier"), ['supplier_id' => $supplier], as: $as ?? $this->owner);

        $assign($id, null)->assertJsonPath('errors.supplier_id.0', 'Choisissez le fournisseur.');
        $assign($id, 999)->assertJsonPath('errors.supplier_id.0', 'Ce fournisseur n’existe pas.');
        // Montants, stock et paiements inchangés ; le reste dû passe chez le fournisseur.
        $assign($id, $this->supplier)->assertOk()->assertJsonPath('data.supplier.name', 'Grossiste Adjamé')
            ->assertJsonPath('data.total', '3000.00')->assertJsonPath('data.paid_amount', '1000.00')->assertJsonPath('data.due_amount', '2000.00');
        $this->assertSame('10.000', $this->stock($this->water));
        $this->api('kone', 'GET', "/suppliers/{$this->supplier}", as: $this->owner)->assertJsonPath('data.due_total', '2000.00');
        $this->assertTrue($this->tenant->run(fn () => DB::table('audit_logs')->where('action', 'purchase.supplier_assigned')->where('subject_id', $id)->exists()));

        // Un fournisseur déjà choisi ne se remplace jamais (ADR-012).
        $other = $this->api('kone', 'POST', '/suppliers', ['name' => 'Autre grossiste'], as: $this->owner)->json('data.id');
        $assign($id, $other)->assertStatus(409)->assertJsonPath('message', 'Cet approvisionnement a déjà un fournisseur.');

        // Annulé : refusé.
        $cancelled = $this->api('kone', 'POST', $this->url('/purchases'), ['items' => [['product_id' => $this->soap, 'quantity' => '1', 'cost' => '350']]], as: $this->owner)->json('data.id');
        $this->api('kone', 'POST', $this->url("/purchases/{$cancelled}/cancel"), ['reason' => 'Erreur'], as: $this->owner)->assertOk();
        $assign($cancelled, $this->supplier)->assertStatus(409);

        // Sans records.view_all, seulement ses propres approvisionnements ; sans purchases.create, refusé.
        $keeper = $this->createUser($this->tenant, ['purchases.view', 'purchases.create'], [$this->shop]);
        $viewer = $this->createUser($this->tenant, ['purchases.view'], [$this->shop]);
        $mine = $this->api('kone', 'POST', $this->url('/purchases'), ['items' => [['product_id' => $this->soap, 'quantity' => '1', 'cost' => '350']]], as: $keeper)->json('data.id');
        $owners = $this->api('kone', 'POST', $this->url('/purchases'), ['items' => [['product_id' => $this->soap, 'quantity' => '1', 'cost' => '350']]], as: $this->owner)->json('data.id');
        $assign($owners, $this->supplier, $keeper)->assertNotFound();
        $assign($mine, $this->supplier, $viewer)->assertForbidden();
        $assign($mine, $this->supplier, $keeper)->assertOk();

        // Un autre espace ne voit pas cet approvisionnement.
        ['owner' => $stranger] = $this->createTenant('sow', email: 'sow@example.ci', phone: '0700000002');
        $this->api('sow', 'PUT', $this->url("/purchases/{$owners}/supplier"), ['supplier_id' => $this->supplier], as: $stranger)->assertNotFound();
    }

    public function test_a_supplier_shows_its_products_and_a_product_its_suppliers(): void
    {
        $other = $this->api('kone', 'POST', '/suppliers', ['name' => 'Grossiste Treichville'], as: $this->owner)->json('data.id');
        $buy = fn (?int $supplier, array $items) => $this->api('kone', 'POST', $this->url('/purchases'), ['supplier_id' => $supplier, 'items' => $items], as: $this->owner)->assertCreated()->json('data.id');

        // Il y a 10 jours : 2 cartons de 12 à 3 000 (250 l'unité) et 10 savons à 340.
        $this->travelTo(now()->subDays(10));
        $buy($this->supplier, [['product_id' => $this->water, 'quantity' => '2', 'cost' => '3000', 'unit_id' => $this->carton], ['product_id' => $this->soap, 'quantity' => '10', 'cost' => '340']]);
        $this->travelBack();
        $buy($this->supplier, [['product_id' => $this->water, 'quantity' => '24', 'cost' => '260']]);
        $buy($other, [['product_id' => $this->water, 'quantity' => '12', 'cost' => '240']]);
        $this->travel(1)->minutes();
        // Acheté au carton : le prix de la ligne garde son unité, ramené à 240 l'unité.
        $buy($other, [['product_id' => $this->water, 'quantity' => '1', 'cost' => '2880', 'unit_id' => $this->carton]]);
        $buy(null, [['product_id' => $this->soap, 'quantity' => '5', 'cost' => '330']]);
        // Annulé : ne compte pas.
        $cancelled = $buy($this->supplier, [['product_id' => $this->soap, 'quantity' => '1', 'cost' => '999']]);
        $this->api('kone', 'POST', $this->url("/purchases/{$cancelled}/cancel"), ['reason' => 'Erreur'], as: $this->owner)->assertOk();

        $products = $this->api('kone', 'GET', "/suppliers/{$this->supplier}/products?shop_id={$this->shop->id}", as: $this->owner)->assertOk()->json('data');
        $this->assertSame(['Eau 1,5 L', 'Savon'], array_column(array_column($products, 'product'), 'name'));
        $this->assertEquals([
            'last_cost' => '260.00', 'last_unit_cost' => '260.00', 'previous_cost' => '250.00', 'min_cost' => '250.00', 'max_cost' => '260.00',
            'purchases' => 2, 'quantity' => '48.000', 'spent' => '12240.00', 'stock' => ['quantity' => '72.000', 'state' => 'ok'],
        ], array_intersect_key($products[0], array_flip(['last_cost', 'last_unit_cost', 'previous_cost', 'min_cost', 'max_cost', 'purchases', 'quantity', 'spent', 'stock'])));
        $this->assertSame(['340.00', null, 1, '3400.00'], [$products[1]['last_cost'], $products[1]['previous_cost'], $products[1]['purchases'], $products[1]['spent']]);

        // Fournisseurs d'un produit : le moins cher d'abord ; les achats sans fournisseur à part.
        $this->api('kone', 'GET', "/products/{$this->water}/suppliers", as: $this->owner)->assertOk()
            ->assertJsonPath('data.0.supplier.name', 'Grossiste Treichville')->assertJsonPath('data.0.last_cost', '240.00')
            ->assertJsonPath('data.0.last_unit_cost', '2880.00')->assertJsonPath('data.0.last_unit.short_name', 'ctn')->assertJsonPath('data.0.quantity', '24.000')
            ->assertJsonPath('data.1.supplier.id', $this->supplier)->assertJsonPath('data.1.last_cost', '260.00')->assertJsonPath('data.1.purchases', 2);
        $this->api('kone', 'GET', "/products/{$this->soap}/suppliers", as: $this->owner)
            ->assertJsonPath('data.0.supplier', null)->assertJsonPath('data.0.last_cost', '330.00')->assertJsonPath('data.1.last_cost', '340.00')->assertJsonCount(2, 'data');

        // Racheter chez ce fournisseur : ses articles avec le dernier prix et la dernière unité ; to_restock = stock faible ou rupture.
        $milk = $this->api('kone', 'POST', '/products', ['name' => 'Lait', 'price' => '600', 'stock_alert' => '20'], as: $this->owner)->json('data.id');
        $buy($this->supplier, [['product_id' => $milk, 'quantity' => '1', 'cost' => '5400', 'unit_id' => $this->carton]]);
        $search = fn (string $extra) => $this->api('kone', 'GET', $this->url("/products/search?supplier_id={$this->supplier}{$extra}"), as: $this->owner)->json('data');
        $this->assertEqualsCanonicalizing(['Eau 1,5 L', 'Savon', 'Lait'], array_column($search(''), 'name'));
        $restock = $search('&to_restock=true');
        $this->assertSame(['Lait'], array_column($restock, 'name'));
        $this->assertSame(['unit_id' => $this->carton, 'cost' => '5400.00'], $restock[0]['supplier_last']);
        $this->assertSame('260.00', collect($search(''))->firstWhere('name', 'Eau 1,5 L')['supplier_last']['cost']);
        $cashier = $this->createUser($this->tenant, ['sales.create'], [$this->shop]);
        $this->api('kone', 'GET', $this->url("/products/search?supplier_id={$this->supplier}"), as: $cashier)->assertForbidden();

        // Les prix d'achat demandent aussi purchases.view ; le stock, l'accès à la boutique.
        $viewer = $this->createUser($this->tenant, ['suppliers.view', 'products.view'], [$this->shop]);
        $this->api('kone', 'GET', "/suppliers/{$this->supplier}/products", as: $viewer)->assertForbidden();
        $this->api('kone', 'GET', "/products/{$this->water}/suppliers", as: $viewer)->assertForbidden();
        $buyer = $this->createUser($this->tenant, ['suppliers.view', 'purchases.view'], []);
        $this->api('kone', 'GET', "/suppliers/{$this->supplier}/products?shop_id={$this->shop->id}", as: $buyer)->assertForbidden();
        // Sans boutique affectée, aucun achat visible.
        $this->api('kone', 'GET', "/suppliers/{$this->supplier}/products", as: $buyer)->assertOk()->assertJsonCount(0, 'data');
    }

    private function purchase(string $quantity, string $cost, ?string $paid = null)
    {
        return $this->api('kone', 'POST', $this->url('/purchases'), [
            'supplier_id' => $this->supplier, 'items' => [['product_id' => $this->water, 'quantity' => $quantity, 'cost' => $cost]],
            ...($paid ? ['paid_amount' => $paid, 'payment_method_id' => $this->cash] : []),
        ], as: $this->owner)->assertCreated();
    }

    private function stock(int $product): string
    {
        return (string) $this->tenant->run(fn () => DB::table('shop_stock')->where('shop_id', $this->shop->id)->where('product_id', $product)->value('quantity'));
    }

    private function url(string $path): string
    {
        return "/shops/{$this->shop->id}{$path}";
    }
}
