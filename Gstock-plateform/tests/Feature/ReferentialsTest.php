<?php

namespace Tests\Feature;

use App\Domain\Catalog\Models\Unit;
use Tests\TestCase;

/** Référentiels (M05) : catégories, unités, modes de paiement, catégories de dépenses, marques. */
class ReferentialsTest extends TestCase
{
    public function test_a_new_space_gets_default_units_payment_methods_and_expense_categories(): void
    {
        ['owner' => $owner] = $this->createTenant();

        $units = $this->api('kone', 'GET', '/units?per_page=100', as: $owner)->assertOk()->json('data');
        $this->assertSame(['Unité', 'Paquet', 'Bouteille', 'Sachet', 'Kilogramme', 'Litre', 'Carton', 'Gramme'], array_column($units, 'name'));
        $carton = collect($units)->firstWhere('name', 'Carton');
        $this->assertSame(['operator' => '*', 'operator_value' => '12', 'base_unit_id' => collect($units)->firstWhere('name', 'Unité')['id']], [
            'operator' => $carton['operator'], 'operator_value' => $carton['operator_value'], 'base_unit_id' => $carton['base_unit_id'],
        ]);
        $this->assertSame('1000', collect($units)->firstWhere('name', 'Gramme')['operator_value']);

        $methods = $this->api('kone', 'GET', '/payment-methods', as: $owner)->assertJsonCount(3, 'data')->json('data');
        $this->assertSame(['name' => 'Espèces', 'type' => 'cash', 'uses_geniuspay' => false, 'is_active' => true], array_diff_key($methods[0], ['id' => 0]));
        $this->assertTrue($methods[1]['uses_geniuspay']);
        $this->api('kone', 'GET', '/expense-categories', as: $owner)->assertJsonCount(6, 'data')->assertJsonPath('data.0.name', 'Transport');
        $this->api('kone', 'GET', '/categories', as: $owner)->assertJsonCount(0, 'data');
    }

    public function test_categories_are_created_renamed_and_deactivated_but_never_deleted(): void
    {
        ['owner' => $owner] = $this->createTenant();

        $this->api('kone', 'POST', '/categories', ['name' => ' '], as: $owner)->assertJsonPath('errors.name.0', 'Donnez un nom à la catégorie.');
        $id = $this->api('kone', 'POST', '/categories', ['name' => 'Boissons', 'color' => 'mint'], as: $owner)
            ->assertCreated()->assertJsonPath('data', fn ($d) => $d['name'] === 'Boissons' && $d['color'] === 'mint' && $d['is_active'] === true && $d['products_count'] === 0)
            ->json('data.id');
        $this->api('kone', 'POST', '/categories', ['name' => 'boissons'], as: $owner)->assertJsonPath('errors.name.0', 'Ce nom existe déjà dans la liste.');
        $this->api('kone', 'POST', '/categories', ['name' => 'Épices', 'color' => 'violet'], as: $owner)->assertJsonPath('data.color', 'lavender');

        $this->api('kone', 'PUT', "/categories/{$id}", ['name' => 'Boissons fraîches', 'color' => 'mint', 'is_active' => false], as: $owner)
            ->assertOk()->assertJsonPath('data.is_active', false)->assertJsonPath('data.name', 'Boissons fraîches');
        $this->api('kone', 'GET', '/categories?filter[is_active]=true', as: $owner)->assertJsonCount(1, 'data');
        $this->api('kone', 'DELETE', "/categories/{$id}", as: $owner)->assertStatus(405);
    }

    public function test_derived_units_follow_the_rules_of_7_3(): void
    {
        ['tenant' => $tenant, 'owner' => $owner] = $this->createTenant();
        [$piece, $carton] = $tenant->run(fn () => [Unit::query()->where('name', 'Unité')->value('id'), Unit::query()->where('name', 'Carton')->value('id')]);

        $this->api('kone', 'POST', '/units', ['name' => 'Pack', 'short_name' => '', 'base_unit_id' => $carton, 'operator' => '+', 'operator_value' => '0'], as: $owner)
            ->assertUnprocessable()
            ->assertJsonPath('errors.short_name.0', 'Donnez une abréviation, par exemple « ctn ».')
            ->assertJsonPath('errors.base_unit_id.0', 'Choisissez une unité de base.')
            ->assertJsonPath('errors.operator.0', 'Choisissez comment les deux unités se comparent.')
            ->assertJsonPath('errors.operator_value.0', 'Saisissez un nombre supérieur à 0.');
        $this->api('kone', 'POST', '/units', ['name' => 'Pack de 6', 'short_name' => 'pk6', 'base_unit_id' => $piece, 'operator' => '*', 'operator_value' => '6'], as: $owner)
            ->assertCreated()->assertJsonPath('data.operator_value', '6');
        // Une unité de base dont d'autres dépendent ne devient pas dérivée.
        $this->api('kone', 'PUT', "/units/{$piece}", ['name' => 'Unité', 'short_name' => 'u', 'base_unit_id' => $carton, 'operator' => '*', 'operator_value' => '2'], as: $owner)
            ->assertJsonPath('errors.base_unit_id.0', "D'autres unités dépendent de celle-ci : elle doit rester une unité de base.");
    }

    public function test_geniuspay_is_only_for_mobile_money_and_cards(): void
    {
        ['owner' => $owner] = $this->createTenant();

        $this->api('kone', 'POST', '/payment-methods', ['name' => 'Chèque', 'type' => 'cheque'], as: $owner)->assertJsonPath('errors.type.0', 'Choisissez le type de paiement.');
        $this->api('kone', 'POST', '/payment-methods', ['name' => 'Wave', 'type' => 'mobile_money', 'uses_geniuspay' => true], as: $owner)->assertJsonPath('data.uses_geniuspay', true);
        $this->api('kone', 'POST', '/payment-methods', ['name' => 'Bon d’achat', 'type' => 'other', 'uses_geniuspay' => true], as: $owner)->assertJsonPath('data.uses_geniuspay', false);
    }

    public function test_reading_and_writing_need_the_right_permissions(): void
    {
        ['tenant' => $tenant, 'shop' => $shop] = $this->createTenant();
        $cashier = $this->createUser($tenant, ['sales.create', 'products.view'], [$shop]);
        $stock = $this->createUser($tenant, ['units.manage'], [$shop]);

        $this->api('kone', 'GET', '/payment-methods', as: $cashier)->assertOk();
        $this->api('kone', 'GET', '/categories', as: $cashier)->assertOk();
        $this->api('kone', 'POST', '/categories', ['name' => 'X'], as: $cashier)->assertForbidden();
        $this->api('kone', 'GET', '/expense-categories', as: $cashier)->assertForbidden();
        $this->api('kone', 'POST', '/units', ['name' => 'Seau', 'short_name' => 'seau'], as: $stock)->assertCreated();
        $this->api('kone', 'POST', '/payment-methods', ['name' => 'Y', 'type' => 'cash'], as: $stock)->assertForbidden();
    }

    public function test_referentials_of_another_space_are_invisible(): void
    {
        ['owner' => $a] = $this->createTenant('kone');
        ['owner' => $b] = $this->createTenant('diallo', email: 'b@example.ci');
        $id = $this->api('diallo', 'POST', '/brands', ['name' => 'Dinor'], as: $b)->assertCreated()->json('data.id');

        $this->api('kone', 'GET', '/brands', as: $a)->assertJsonCount(0, 'data');
        $this->api('kone', 'PUT', "/brands/{$id}", ['name' => 'Piraté'], as: $a)->assertNotFound();
        // Le même nom est permis dans un autre espace.
        $this->api('kone', 'POST', '/brands', ['name' => 'Dinor'], as: $a)->assertCreated();
    }
}
