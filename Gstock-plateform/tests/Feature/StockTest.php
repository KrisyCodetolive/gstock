<?php

namespace Tests\Feature;

use App\Domain\Platform\Models\Tenant;
use App\Domain\Shops\Models\Shop;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** Mon stock (M07) : mouvements MS-N, jamais de stock négatif, toujours égal à la somme des mouvements (§7.2). */
class StockTest extends TestCase
{
    private Tenant $tenant;

    private Shop $shop;

    private array $product;

    private $owner;

    protected function setUp(): void
    {
        parent::setUp();
        ['tenant' => $this->tenant, 'owner' => $owner, 'shop' => $this->shop] = $this->createTenant();
        $this->owner = $owner;
        $this->product = $this->api('kone', 'POST', '/products', ['name' => 'Riz 5 kg', 'price' => '4500', 'cost' => '3900', 'stock_alert' => '5', 'initial_quantity' => '10', 'shop_id' => $this->shop->id], as: $owner)->json('data');
    }

    private function adjust(string $kind, string $quantity, array $extra = [], $as = null)
    {
        $field = $kind === 'inventory' ? 'counted_quantity' : 'quantity';

        return $this->api('kone', 'POST', "/shops/{$this->shop->id}/adjustments", [
            'kind' => $kind, 'reason' => 'Casse', 'items' => [['product_id' => $this->product['id'], $field => $quantity]], ...$extra,
        ], as: $as ?? $this->owner);
    }

    public function test_entries_exits_and_inventories_are_numbered_and_move_the_stock(): void
    {
        $this->adjust('entry', '5')->assertCreated()->assertJsonPath('data.reference', 'MS-1')->assertJsonPath('data.items.0.quantity', '5.000');
        $this->adjust('exit', '3')->assertCreated()->assertJsonPath('data.reference', 'MS-2');
        $inventory = $this->adjust('inventory', '9.5')->assertCreated()->assertJsonPath('data.reference', 'MS-3');
        // 10 + 5 − 3 = 12 ; compté 9,5 → écart −2,5.
        $inventory->assertJsonPath('data.items.0.quantity', '-2.500')->assertJsonPath('data.items.0.counted_quantity', '9.500');
        $this->assertSame('9.500', $this->quantity());

        $movements = $this->api('kone', 'GET', "/shops/{$this->shop->id}/stock/movements?product_id={$this->product['id']}", as: $this->owner)->json('data');
        $this->assertSame(['-2.500', '-3.000', '5.000', '10.000'], array_column($movements, 'quantity'));
        $this->assertSame(['9.500', '12.000', '15.000', '10.000'], array_column($movements, 'balance'));
        $this->assertSame(['adjustment', 'adjustment', 'adjustment', 'opening'], array_column($movements, 'source_type'));
        $this->assertStockMatchesMovements();
    }

    public function test_stock_never_goes_negative(): void
    {
        $this->adjust('exit', '11')->assertUnprocessable()
            ->assertJsonPath('message', 'Stock insuffisant : il reste 10 u de Riz 5 kg.')
            ->assertJsonPath('errors.items.0', 'Stock insuffisant : il reste 10 u de Riz 5 kg.');
        $this->assertSame('10.000', $this->quantity());
        // Rien n'a été écrit, pas même la référence.
        $this->assertSame(0, DB::table('adjustments')->count());
        $this->adjust('entry', '1')->assertJsonPath('data.reference', 'MS-1');

        // Deux lignes sur le même article : le contrôle porte sur leur total.
        $this->api('kone', 'POST', "/shops/{$this->shop->id}/adjustments", ['kind' => 'exit', 'reason' => 'Perte', 'items' => [
            ['product_id' => $this->product['id'], 'quantity' => '6'], ['product_id' => $this->product['id'], 'quantity' => '6'],
        ]], as: $this->owner)->assertJsonPath('errors.items.0', 'Un même produit apparaît deux fois.');
        $this->adjust('inventory', '-1')->assertJsonPath('errors.items.0', 'Saisissez la quantité comptée pour Riz 5 kg.');
        $this->adjust('exit', '0')->assertJsonPath('errors.items.0', 'Saisissez une quantité supérieure à 0 pour Riz 5 kg.');
        $this->assertStockMatchesMovements();
    }

    public function test_a_cancelled_adjustment_is_kept_and_reversed_but_never_below_zero(): void
    {
        $entry = $this->adjust('entry', '5')->json('data.id');
        $this->adjust('exit', '14');
        $this->assertSame('1.000', $this->quantity());

        // Reprendre l'entrée ferait passer le stock à −4 : refusé (§7.2).
        $this->api('kone', 'POST', "/shops/{$this->shop->id}/adjustments/{$entry}/cancel", ['reason' => 'Erreur'], as: $this->owner)
            ->assertUnprocessable()->assertJsonPath('message', 'Stock insuffisant : il reste 1 u de Riz 5 kg.');
        $exit = DB::table('adjustments')->where('kind', 'exit')->value('id');
        $this->api('kone', 'POST', "/shops/{$this->shop->id}/adjustments/{$exit}/cancel", ['reason' => ''], as: $this->owner)
            ->assertJsonPath('errors.reason.0', 'Indiquez pourquoi vous annulez ce mouvement.');
        $this->api('kone', 'POST', "/shops/{$this->shop->id}/adjustments/{$exit}/cancel", ['reason' => 'Erreur de saisie'], as: $this->owner)
            ->assertOk()->assertJsonPath('data.status', 'cancelled')->assertJsonPath('data.cancel_reason', 'Erreur de saisie');
        $this->assertSame('15.000', $this->quantity());
        $this->api('kone', 'POST', "/shops/{$this->shop->id}/adjustments/{$exit}/cancel", ['reason' => 'Encore'], as: $this->owner)
            ->assertStatus(409)->assertJsonPath('message', 'Ce mouvement a déjà été annulé.');
        $this->assertTrue(DB::table('audit_logs')->where('action', 'stock.adjustment_cancelled')->exists());
        $this->assertStockMatchesMovements();
    }

    public function test_offline_adjustments_are_idempotent(): void
    {
        $uuid = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
        $this->adjust('entry', '2', ['offline_uuid' => $uuid])->assertCreated();
        $this->adjust('entry', '2', ['offline_uuid' => $uuid])->assertOk()->assertJsonPath('data.reference', 'MS-1');
        $this->assertSame('12.000', $this->quantity());
    }

    public function test_each_kind_needs_its_permission_and_users_see_their_own_operations(): void
    {
        $keeper = $this->createUser($this->tenant, ['stock.view', 'stock.entry'], [$this->shop]);
        $this->adjust('exit', '1', as: $keeper)->assertForbidden();
        $mine = $this->adjust('entry', '1', as: $keeper)->assertCreated()->json('data.id');
        $owners = $this->adjust('entry', '1')->json('data.id');

        $this->api('kone', 'GET', "/shops/{$this->shop->id}/adjustments/{$mine}", as: $keeper)->assertOk();
        $this->api('kone', 'GET', "/shops/{$this->shop->id}/adjustments/{$owners}", as: $keeper)->assertNotFound();
        $this->assertSame([$mine], array_column($this->api('kone', 'GET', "/shops/{$this->shop->id}/stock/movements", as: $keeper)->json('data'), 'source_id'));
        $this->api('kone', 'POST', "/shops/{$this->shop->id}/adjustments/{$mine}/cancel", ['reason' => 'x'], as: $keeper)->assertForbidden();
    }

    public function test_shop_resources_need_an_assignment_to_an_open_shop(): void
    {
        $other = $this->api('kone', 'POST', '/shops', ['name' => 'Boutique Yopougon', 'city' => 'Abidjan'], as: $this->owner)->json('data.id');
        $seller = $this->createUser($this->tenant, ['stock.view'], [$this->shop]);

        $this->api('kone', 'GET', "/shops/{$other}/stock", as: $seller)->assertForbidden()->assertJsonPath('message', "Vous n'avez pas accès à cette boutique.");
        $this->api('kone', 'GET', "/shops/{$this->shop->id}/stock", as: $seller)->assertOk();
        // La nouvelle boutique a reçu une ligne à 0 pour le produit existant.
        $this->api('kone', 'GET', "/shops/{$other}/stock", as: $this->owner)->assertJsonPath('data.0.quantity', '0.000')->assertJsonPath('data.0.state', 'out');

        $this->api('kone', 'PUT', "/shops/{$other}", ['name' => 'Boutique Yopougon', 'city' => 'Abidjan', 'is_active' => false], as: $this->owner)->assertOk();
        $this->api('kone', 'GET', "/shops/{$other}/stock", as: $this->owner)->assertForbidden()->assertJsonPath('message', 'Cette boutique est fermée.');
    }

    public function test_stock_list_summary_alerts_and_all_shops_view(): void
    {
        $this->api('kone', 'POST', '/products', ['name' => 'Savon', 'price' => '300', 'cost' => '200', 'stock_alert' => '5', 'initial_quantity' => '2', 'shop_id' => $this->shop->id], as: $this->owner);
        $this->api('kone', 'POST', '/products', ['name' => 'Livraison', 'price' => '500', 'type' => 'service'], as: $this->owner);
        $this->api('kone', 'POST', '/products', ['name' => 'Sucre', 'price' => '900'], as: $this->owner);

        $list = $this->api('kone', 'GET', "/shops/{$this->shop->id}/stock", as: $this->owner)->assertOk();
        $list->assertJsonPath('summary', ['products' => 3, 'low' => 1, 'out' => 1, 'value' => '39400.00'])
            ->assertJsonPath('meta.total', 3);
        $this->assertSame(['Riz 5 kg', 'Savon', 'Sucre'], array_column(array_column($list->json('data'), 'product'), 'name'));
        $this->assertSame('39000.00', $list->json('data.0.value'));

        $this->api('kone', 'GET', "/shops/{$this->shop->id}/stock?filter[state]=low", as: $this->owner)->assertJsonCount(1, 'data')->assertJsonPath('summary.products', 3);
        $this->api('kone', 'GET', "/shops/{$this->shop->id}/stock/alerts", as: $this->owner)->assertJsonCount(2, 'data');
        $this->api('kone', 'GET', '/stock?search=riz', as: $this->owner)->assertJsonPath('data.0.total', '10.000')->assertJsonPath('data.0.shops.0.shop_id', $this->shop->id);
    }

    private function quantity(): string
    {
        return (string) DB::table('shop_stock')->where('shop_id', $this->shop->id)->where('product_id', $this->product['id'])->value('quantity');
    }

    private function assertStockMatchesMovements(): void
    {
        $gaps = DB::select('select s.id from shop_stock s where s.tenant_id = ? and s.quantity <> coalesce((select sum(m.quantity) from stock_movements m
            where m.shop_id = s.shop_id and m.product_id = s.product_id and m.product_variant_id is not distinct from s.product_variant_id), 0)', [$this->tenant->id]);
        $this->assertSame([], $gaps, 'Le stock doit égaler la somme des mouvements (§7.2).');
    }
}
