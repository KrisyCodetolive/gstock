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
