<?php

namespace Tests\Feature;

use App\Domain\Identity\Models\Role;
use App\Domain\Identity\Models\User;
use App\Domain\Shops\Models\Shop;
use Tests\TestCase;

/** Isolation des espaces (ADR-002, §12.2) : rien d'un espace n'est visible ni modifiable depuis un autre. */
class TenantIsolationTest extends TestCase
{
    public function test_the_same_email_can_exist_in_two_spaces_and_logs_into_its_own_space_only(): void
    {
        $this->createTenant('kone', email: 'awa@example.ci');
        $this->createTenant('diallo', email: 'awa@example.ci');
        $bamba = $this->createTenant('bamba', email: 'bamba@example.ci');
        $bamba['tenant']->run(fn () => $bamba['owner']->update(['password' => 'autre-mot']));

        $this->api('kone', 'POST', '/auth/login', ['login' => 'awa@example.ci', 'password' => 'secret123'])->assertOk();
        // Les identifiants d'un autre espace ne valent rien ici.
        $this->api('kone', 'POST', '/auth/login', ['login' => 'bamba@example.ci', 'password' => 'autre-mot'])
            ->assertUnprocessable()->assertJsonPath('errors.login.0', 'E-mail, téléphone ou mot de passe incorrect.');
    }

    public function test_records_of_another_space_are_not_found(): void
    {
        $a = $this->createTenant('kone');
        $b = $this->createTenant('diallo', email: 'b@example.ci');
        $bUser = $this->createUser($b['tenant'], ['products.view']);
        $bRole = $b['tenant']->run(fn () => Role::query()->where('is_owner', false)->first());

        $this->api('kone', 'GET', '/users/'.$bUser->id, as: $a['owner'])->assertNotFound();
        $this->api('kone', 'GET', '/shops/'.$b['shop']->id, as: $a['owner'])->assertNotFound();
        $this->api('kone', 'PUT', '/roles/'.$bRole->id, ['name' => 'Piraté', 'permissions' => ['sales.view']], as: $a['owner'])->assertNotFound();
        $this->api('kone', 'PATCH', '/users/'.$bUser->id.'/status', ['is_active' => false], as: $a['owner'])->assertNotFound();

        $users = $this->api('kone', 'GET', '/users', as: $a['owner'])->assertOk()->json('data');
        $this->assertSame([$a['owner']->id], array_column($users, 'id'));
        $shops = $this->api('kone', 'GET', '/shops', as: $a['owner'])->assertOk()->json('data');
        $this->assertSame([$a['shop']->id], array_column($shops, 'id'));
        $this->assertTrue($b['tenant']->run(fn () => User::query()->whereKey($bUser->id)->value('is_active')));
    }

    public function test_an_account_is_refused_on_the_subdomain_of_another_space(): void
    {
        $this->createTenant('kone');
        $b = $this->createTenant('diallo', email: 'b@example.ci');

        $this->api('kone', 'GET', '/me', as: $b['owner'])->assertUnauthorized();
    }

    public function test_assigning_a_shop_of_another_space_is_refused(): void
    {
        $a = $this->createTenant('kone');
        $b = $this->createTenant('diallo', email: 'b@example.ci');
        $seller = $this->createUser($a['tenant'], ['sales.view']);

        $this->api('kone', 'PUT', "/users/{$seller->id}/shops", ['shop_ids' => [$b['shop']->id]], as: $a['owner'])
            ->assertUnprocessable()->assertJsonPath('errors.shop_ids.0', 'Une boutique choisie n’existe pas.');
        $this->assertSame(0, $a['tenant']->run(fn () => $seller->shops()->count()));
    }

    public function test_an_unknown_subdomain_is_a_404(): void
    {
        $this->api('inconnu', 'POST', '/auth/login', ['login' => 'x', 'password' => 'y'])
            ->assertNotFound()->assertJsonPath('message', "Cet espace n'existe pas. Vérifiez l'adresse.");
    }

    public function test_rows_get_the_tenant_id_of_the_request(): void
    {
        $a = $this->createTenant('kone');
        $this->api('kone', 'POST', '/shops', ['name' => 'Boutique Yopougon', 'city' => 'Abidjan'], as: $a['owner'])->assertCreated();

        $this->assertSame($a['tenant']->id, Shop::query()->withoutGlobalScopes()->where('name', 'Boutique Yopougon')->value('tenant_id'));
    }
}
