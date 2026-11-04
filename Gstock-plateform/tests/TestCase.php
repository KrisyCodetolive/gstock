<?php

namespace Tests;

use App\Domain\Identity\Models\Permission;
use App\Domain\Identity\Models\Role;
use App\Domain\Identity\Models\User;
use App\Domain\Platform\Actions\ProvisionTenant;
use App\Domain\Platform\Models\Plan;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Shops\Models\Shop;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;

abstract class TestCase extends BaseTestCase
{
    use RefreshDatabase;

    /** Domaine central des tests (phpunit.xml : TENANCY_CENTRAL_DOMAINS). */
    protected const DOMAIN = 'gstock.test';

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PlanSeeder::class);
    }

    protected function tearDown(): void
    {
        tenancy()->end();
        parent::tearDown();
    }

    /**
     * Crée un espace avec son propriétaire et sa première boutique.
     *
     * @return array{tenant: Tenant, owner: User, shop: Shop}
     */
    protected function createTenant(string $slug = 'kone', string $plan = 'Commerce', string $email = 'owner@example.ci', string $phone = '0700000001'): array
    {
        $result = app(ProvisionTenant::class)->handle([
            'name' => ucfirst($slug),
            'slug' => $slug,
            'plan' => Plan::query()->where('name', $plan)->firstOrFail(),
            'shop' => ['name' => 'Boutique principale', 'city' => 'Abidjan'],
            'owner' => ['firstname' => 'Awa', 'lastname' => 'Koné', 'email' => $email, 'phone' => $phone, 'password' => 'secret123'],
        ]);
        // Abonnement payé pour 30 jours : l'espace est utilisable.
        $result['tenant']->subscription->update(['ends_at' => now()->addDays(30), 'status' => 'active']);

        return $result;
    }

    /** Crée, dans l'espace, un rôle avec ces permissions et un utilisateur qui l'a. */
    protected function createUser(Tenant $tenant, array $permissions, array $shops = [], array $attributes = []): User
    {
        return $tenant->run(function () use ($permissions, $shops, $attributes) {
            $role = Role::create(['name' => 'Rôle '.uniqid()]);
            $role->permissions()->sync(Permission::query()->whereIn('name', $permissions)->pluck('id'));
            $user = User::create([
                'firstname' => 'Fatou', 'lastname' => 'Bamba', 'email' => uniqid().'@example.ci',
                'password' => 'secret123', 'role_id' => $role->id, 'is_active' => true, ...$attributes,
            ]);
            $user->shops()->sync(collect($shops)->pluck('id'));

            return $user;
        });
    }

    /** Requête JSON sur le sous-domaine d'un espace, comme le frontend (ADR-009). */
    protected function api(string $slug, string $method, string $uri, array $data = [], ?User $as = null): TestResponse
    {
        if ($as) {
            // Helper de Sanctum pour les tests d'API ; la vraie connexion (cookie) est testée dans AuthTest.
            Sanctum::actingAs($as);
        }
        $response = $this->json($method, 'http://'.$slug.'.'.self::DOMAIN.'/api/v1'.$uri, $data, [
            'Referer' => 'http://'.$slug.'.'.self::DOMAIN.'/',
        ]);
        tenancy()->end();

        return $response;
    }
}
