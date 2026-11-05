<?php

namespace Tests\Feature;

use App\Domain\Catalog\Models\Unit;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Stock\Models\ShopStock;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** Mes produits (M06) : catalogue commun, variantes, unité d'achat, photo, recherche. */
class ProductsTest extends TestCase
{
    public function test_a_product_is_created_with_just_a_name_and_a_price(): void
    {
        ['tenant' => $tenant, 'owner' => $owner, 'shop' => $shop] = $this->createTenant();
        $other = $this->api('kone', 'POST', '/shops', ['name' => 'Boutique Yopougon', 'city' => 'Abidjan'], as: $owner)->json('data.id');

        $this->api('kone', 'POST', '/products', ['name' => '', 'price' => ''], as: $owner)
            ->assertJsonPath('errors.name.0', 'Donnez un nom au produit.')->assertJsonPath('errors.price.0', 'Saisissez le prix de vente.');
        $product = $this->api('kone', 'POST', '/products', ['name' => 'Riz parfumé 5 kg', 'price' => '4500', 'initial_quantity' => '12', 'shop_id' => $shop->id], as: $owner)
            ->assertCreated()
            ->assertJsonPath('data.code', 'P-0001')
            ->assertJsonPath('data.price', '4500.00')
            ->assertJsonPath('data.unit.name', 'Unité')
            ->assertJsonPath('data.stock', ['quantity' => '12.000', 'stock_alert' => null, 'state' => 'ok'])
            ->json('data');
        $this->api('kone', 'POST', '/products', ['name' => 'Huile', 'price' => '1350'], as: $owner)->assertJsonPath('data.code', 'P-0002');

        // Une ligne de stock dans chaque boutique (§7.2), le stock initial par un mouvement « opening ».
        $rows = $tenant->run(fn () => ShopStock::query()->where('product_id', $product['id'])->orderBy('shop_id')->pluck('quantity', 'shop_id')->all());
        $this->assertEquals([$shop->id => '12.000', $other => '0.000'], $rows);
        $this->assertSame('opening', DB::table('stock_movements')->where('product_id', $product['id'])->value('source_type'));
        $this->assertStockMatchesMovements($tenant);
    }

    public function test_initial_stock_needs_the_right_to_add_stock(): void
    {
        ['tenant' => $tenant, 'shop' => $shop] = $this->createTenant();
        $clerk = $this->createUser($tenant, ['products.view', 'products.create'], [$shop]);

        $this->api('kone', 'POST', '/products', ['name' => 'Savon', 'price' => '300', 'initial_quantity' => '5', 'shop_id' => $shop->id], as: $clerk)
            ->assertForbidden()->assertJsonPath('message', "Vous n'avez pas le droit d'ajouter du stock.");
        $this->api('kone', 'POST', '/products', ['name' => 'Savon', 'price' => '300'], as: $clerk)->assertCreated();
    }

    public function test_each_variant_can_start_with_its_own_stock(): void
    {
        ['tenant' => $tenant, 'owner' => $owner, 'shop' => $shop] = $this->createTenant();
        $tomorrow = now('Africa/Abidjan')->addDay()->toDateString();
        $body = fn (array $extra = []) => ['name' => 'Jus de fruits 1 L', 'type' => 'variable', 'shop_id' => $shop->id, 'track_expiry' => true, 'variants' => [
            ['name' => 'Bissap', 'price' => '900', 'initial_quantity' => '12', 'initial_expiry_date' => $tomorrow],
            ['name' => 'Gingembre', 'price' => '900', 'initial_quantity' => '8'],
            ['name' => 'Ananas', 'price' => '1000'],
        ], ...$extra];

        $this->api('kone', 'POST', '/products', ['name' => 'Jus', 'type' => 'variable', 'shop_id' => $shop->id, 'variants' => [['name' => 'Bissap', 'price' => '900', 'initial_quantity' => '-1']]], as: $owner)
            ->assertUnprocessable()->assertJsonPath('errors.variants.0', 'La quantité de Bissap doit être un nombre positif.');
        $clerk = $this->createUser($tenant, ['products.view', 'products.create'], [$shop]);
        $this->api('kone', 'POST', '/products', $body(), as: $clerk)->assertForbidden();

        $juice = $this->api('kone', 'POST', '/products', $body(), as: $owner)->assertCreated()->json('data');
        $stock = collect($this->api('kone', 'GET', "/products/{$juice['id']}/stock", as: $owner)->json('data'))->firstWhere('shop.id', $shop->id);
        $this->assertSame(['12.000', '8.000', '0.000'], array_column($stock['variants'], 'quantity'));
        // Produit suivi : la date de la variante va sur son arrivage.
        $bissap = $juice['variants'][0]['id'];
        $this->assertSame([$tomorrow], array_column($this->api('kone', 'GET', "/shops/{$shop->id}/stock/lots?product_id={$juice['id']}&variant_id={$bissap}", as: $owner)->json('data'), 'expiry_date'));
        $this->assertStockMatchesMovements($tenant);
    }

    public function test_codes_and_barcodes_are_unique_and_the_plan_limits_products(): void
    {
        ['owner' => $owner] = $this->createTenant(plan: 'Essentiel');
        $this->api('kone', 'POST', '/products', ['name' => 'Coca', 'price' => '400', 'code' => 'COCA', 'barcode' => '5449000000996'], as: $owner)->assertCreated();

        $this->api('kone', 'POST', '/products', ['name' => 'Fanta', 'price' => '400', 'code' => 'coca', 'barcode' => '5449000000996'], as: $owner)
            ->assertJsonPath('errors.code.0', 'Ce code est déjà utilisé par un autre produit.')
            ->assertJsonPath('errors.barcode.0', 'Ce code-barres est déjà utilisé par un autre produit.');
        $this->api('kone', 'POST', '/products', ['name' => 'Jus', 'type' => 'variable', 'variants' => [['name' => 'Bissap', 'price' => '900', 'barcode' => '5449000000996']]], as: $owner)
            ->assertJsonPath('errors.variants.0', 'Le code-barres de Bissap est déjà utilisé par un autre produit.');

        DB::table('plans')->where('name', 'Essentiel')->update(['max_products' => 1]);
        $this->api('kone', 'POST', '/products', ['name' => 'Fanta', 'price' => '400'], as: $owner)
            ->assertJsonPath('errors.name.0', 'Votre abonnement permet 1 produits au maximum. Désactivez des produits que vous ne vendez plus ou passez à une formule supérieure.');
    }

    public function test_variants_have_their_own_price_and_stock(): void
    {
        ['tenant' => $tenant, 'owner' => $owner, 'shop' => $shop] = $this->createTenant();

        $this->api('kone', 'POST', '/products', ['name' => 'Jus', 'type' => 'variable', 'variants' => []], as: $owner)
            ->assertJsonPath('errors.variants.0', 'Ajoutez au moins une variante active (par exemple une taille ou un parfum).');
        $this->api('kone', 'POST', '/products', ['name' => 'Jus', 'type' => 'variable', 'variants' => [['name' => 'Bissap', 'price' => '900'], ['name' => 'bissap', 'price' => '']]], as: $owner)
            ->assertJsonPath('errors.variants', ['Saisissez le prix de la variante bissap.', 'Deux variantes portent le même nom.']);

        $juice = $this->api('kone', 'POST', '/products', ['name' => 'Jus de fruits 1 L', 'type' => 'variable', 'variants' => [
            ['name' => 'Ananas', 'price' => '1000', 'cost' => '700', 'barcode' => '6181100900013'],
            ['name' => 'Bissap', 'price' => '900'],
        ]], as: $owner)->assertCreated()->json('data');
        $this->assertSame('900.00', $juice['price']);
        $this->assertSame(['P-0001-1', 'P-0001-2'], array_column($juice['variants'], 'code'));
        $this->assertSame(2, $tenant->run(fn () => ShopStock::query()->where('product_id', $juice['id'])->whereNotNull('product_variant_id')->count()));

        $articles = $this->api('kone', 'GET', "/shops/{$shop->id}/products/search?q=jus", as: $owner)->assertOk()->json('data');
        $this->assertSame(['Jus de fruits 1 L — Ananas', 'Jus de fruits 1 L — Bissap'], array_column($articles, 'name'));
        $this->api('kone', 'GET', "/shops/{$shop->id}/products/search?q=6181100900013", as: $owner)->assertJsonCount(1, 'data')->assertJsonPath('data.0.variant_name', 'Ananas');

        // Une variante se met hors vente, le prix « à partir de » suit ; le type ne change plus.
        $bissap = $juice['variants'][1]['id'];
        $this->api('kone', 'PUT', "/products/{$juice['id']}", ['name' => 'Jus de fruits 1 L', 'type' => 'variable', 'variants' => [['id' => $bissap, 'name' => 'Bissap', 'price' => '900', 'is_active' => false]]], as: $owner)
            ->assertOk()->assertJsonPath('data.price', '1000.00')->assertJsonCount(2, 'data.variants');
        $this->api('kone', 'GET', "/shops/{$shop->id}/products/search?q=jus", as: $owner)->assertJsonCount(1, 'data');
        $this->api('kone', 'PUT', "/products/{$juice['id']}", ['name' => 'Jus', 'type' => 'simple', 'price' => '900'], as: $owner)
            ->assertJsonPath('errors.type.0', 'Un produit à variantes le reste : désactivez-le et créez-en un autre.');
    }

    public function test_purchase_unit_must_derive_from_the_product_unit(): void
    {
        ['tenant' => $tenant, 'owner' => $owner] = $this->createTenant();
        [$carton, $gram] = $tenant->run(fn () => [Unit::query()->where('name', 'Carton')->value('id'), Unit::query()->where('name', 'Gramme')->value('id')]);

        $this->api('kone', 'POST', '/products', ['name' => 'Coca', 'price' => '400', 'purchase_unit_id' => $gram], as: $owner)
            ->assertJsonPath('errors.purchase_unit_id.0', "L'unité d'achat doit être une unité dérivée de l'unité du produit (par exemple Carton pour Unité).");
        $this->api('kone', 'POST', '/products', ['name' => 'Coca', 'price' => '400', 'purchase_unit_id' => $carton], as: $owner)
            ->assertCreated()->assertJsonPath('data.purchase_unit.factor', '12.000')->assertJsonPath('data.units.1.short_name', 'ctn');

        // L'unité utilisée garde sa conversion (§7.3).
        $this->api('kone', 'PUT', "/units/{$carton}", ['name' => 'Carton', 'short_name' => 'ctn', 'base_unit_id' => $tenant->run(fn () => Unit::query()->where('name', 'Unité')->value('id')), 'operator' => '*', 'operator_value' => '24'], as: $owner)
            ->assertJsonPath('errors.operator_value.0', 'Cette unité sert déjà à des produits : sa conversion ne peut plus changer. Créez une autre unité.');
        $this->api('kone', 'GET', '/units?search=Unité', as: $owner)->assertJsonPath('data.0.products_count', 1);
    }

    public function test_disabling_and_editing_need_their_own_permission_and_a_stocked_product_stays_stockable(): void
    {
        ['tenant' => $tenant, 'owner' => $owner, 'shop' => $shop] = $this->createTenant();
        $editor = $this->createUser($tenant, ['products.view', 'products.update'], [$shop]);
        $id = $this->api('kone', 'POST', '/products', ['name' => 'Savon', 'price' => '300', 'initial_quantity' => '4', 'shop_id' => $shop->id], as: $owner)->json('data.id');

        $this->api('kone', 'PUT', "/products/{$id}", ['name' => 'Savon Lux', 'price' => '350'], as: $editor)->assertOk()->assertJsonPath('data.name', 'Savon Lux');
        $this->api('kone', 'PUT', "/products/{$id}", ['name' => 'Savon Lux', 'price' => '350', 'is_active' => false], as: $editor)->assertForbidden();
        $this->api('kone', 'PUT', "/products/{$id}", ['name' => 'Savon Lux', 'price' => '350', 'type' => 'service'], as: $owner)
            ->assertJsonPath('errors.type.0', 'Ce produit a encore du stock : il ne peut pas devenir un service.');
        $this->api('kone', 'DELETE', "/products/{$id}", as: $owner)->assertStatus(405);
    }

    public function test_photo_and_list_with_shop_stock(): void
    {
        Storage::fake('public');
        ['owner' => $owner, 'shop' => $shop] = $this->createTenant();
        $id = $this->api('kone', 'POST', '/products', ['name' => 'Lait', 'price' => '600', 'stock_alert' => '5', 'initial_quantity' => '3', 'shop_id' => $shop->id], as: $owner)->json('data.id');

        $url = $this->api('kone', 'POST', "/products/{$id}/image", ['image' => UploadedFile::fake()->image('lait.jpg', 400, 400)], as: $owner)->assertOk()->json('data.image_url');
        $this->assertStringContainsString('/products/', $url);
        $this->api('kone', 'GET', "/products?shop_id={$shop->id}&search=lait", as: $owner)
            ->assertJsonPath('data.0.stock.state', 'low')->assertJsonPath('data.0.image_url', $url)->assertJsonPath('meta.total', 1);
        $this->api('kone', 'DELETE', "/products/{$id}/image", as: $owner)->assertJsonPath('data.image_url', null);
        $this->api('kone', 'GET', "/products/{$id}/stock", as: $owner)->assertJsonPath('data.0.shop.id', $shop->id)->assertJsonPath('data.0.quantity', '3.000');
    }

    private function assertStockMatchesMovements(Tenant $tenant): void
    {
        $gaps = DB::select('select s.id from shop_stock s where s.tenant_id = ? and s.quantity <> coalesce((select sum(m.quantity) from stock_movements m
            where m.shop_id = s.shop_id and m.product_id = s.product_id and m.product_variant_id is not distinct from s.product_variant_id), 0)', [$tenant->id]);
        $this->assertSame([], $gaps, 'Le stock doit égaler la somme des mouvements (§7.2).');
    }
}
