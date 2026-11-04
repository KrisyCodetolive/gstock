<?php

namespace Tests\Feature;

use App\Domain\Audit\Models\AuditLog;
use App\Domain\Identity\Models\Role;
use Tests\TestCase;

/** Rôles libres, permissions fixes, utilisateurs et affectations (M04, ADR-014). */
class RolesAndUsersTest extends TestCase
{
    public function test_permissions_are_checked_on_every_endpoint(): void
    {
        ['tenant' => $tenant, 'shop' => $shop] = $this->createTenant();
        $seller = $this->createUser($tenant, ['sales.create', 'sales.view'], [$shop]);

        foreach ([['GET', '/roles'], ['GET', '/permissions'], ['POST', '/roles'], ['GET', '/users'], ['POST', '/users'], ['GET', '/settings'], ['GET', '/settings/payment'], ['POST', '/shops'], ['GET', '/audit-logs']] as [$method, $uri]) {
            $this->api('kone', $method, $uri, as: $seller)->assertForbidden()->assertJsonPath('message', "Vous n'avez pas accès à cette action.");
        }
        $this->api('kone', 'GET', '/me', as: $seller)->assertOk();
    }

    public function test_the_permission_list_is_fixed_and_read_only(): void
    {
        ['owner' => $owner] = $this->createTenant();

        $list = $this->api('kone', 'GET', '/permissions', as: $owner)->assertOk()->json('data');
        $this->assertCount(42, $list);
        $this->assertSame(['name' => 'subscription.manage', 'label' => "Gérer l'abonnement", 'level' => 'tenant', 'group' => 'subscription'], $list[0]);
        $this->api('kone', 'POST', '/permissions', ['name' => 'x'], as: $owner)->assertStatus(405);
    }

    public function test_roles_are_created_updated_and_protected(): void
    {
        ['tenant' => $tenant, 'owner' => $owner] = $this->createTenant();

        $this->api('kone', 'POST', '/roles', ['name' => 'Propriétaire', 'permissions' => ['sales.view']], as: $owner)
            ->assertJsonPath('errors.name.0', 'Ce nom est réservé au rôle du propriétaire.');
        $this->api('kone', 'POST', '/roles', ['name' => 'Vendeur', 'permissions' => []], as: $owner)
            ->assertJsonPath('errors.permissions.0', 'Cochez au moins une permission.');
        $this->api('kone', 'POST', '/roles', ['name' => 'Vendeur', 'permissions' => ['sales.fly']], as: $owner)
            ->assertJsonPath('errors', ['permissions.0' => ['Une permission inconnue a été envoyée.']]);

        $role = $this->api('kone', 'POST', '/roles', ['name' => 'Vendeur', 'description' => 'Vend.', 'permissions' => ['sales.view', 'sales.create']], as: $owner)
            ->assertCreated()->assertJsonPath('data.permissions', ['sales.create', 'sales.view'])->assertJsonPath('data.users_count', 0)->json('data');
        $this->api('kone', 'POST', '/roles', ['name' => 'vendeur', 'permissions' => ['sales.view']], as: $owner)
            ->assertJsonPath('errors.name.0', 'Un autre rôle porte déjà ce nom.');

        // Owner : ni modifié, ni supprimé.
        $ownerRole = $tenant->run(fn () => Role::query()->where('is_owner', true)->first());
        $this->api('kone', 'PUT', '/roles/'.$ownerRole->id, ['name' => 'Chef', 'permissions' => ['sales.view']], as: $owner)
            ->assertForbidden()->assertJsonPath('message', 'Le rôle du propriétaire ne peut être ni modifié ni supprimé.');
        $this->api('kone', 'DELETE', '/roles/'.$ownerRole->id, as: $owner)->assertForbidden();

        // Un changement de permissions s'applique tout de suite à ceux qui ont le rôle.
        $seller = $this->createUser($tenant, [], attributes: ['role_id' => $role['id']]);
        $this->api('kone', 'GET', '/me', as: $seller)->assertJsonPath('data.permissions', ['sales.create', 'sales.view']);
        $this->api('kone', 'PUT', '/roles/'.$role['id'], ['name' => 'Vendeur', 'permissions' => ['sales.view', 'credits.view']], as: $owner)->assertOk();
        $this->api('kone', 'GET', '/me', as: $seller->fresh())->assertJsonPath('data.permissions', ['sales.view', 'credits.view']);

        $this->api('kone', 'DELETE', '/roles/'.$role['id'], as: $owner)
            ->assertStatus(409)->assertJsonPath('message', 'Ce rôle est attribué à 1 utilisateur. Donnez-leur un autre rôle avant de le supprimer.');
        $unused = $this->api('kone', 'POST', '/roles', ['name' => 'Inutile', 'permissions' => ['stock.view']], as: $owner)->json('data.id');
        $this->api('kone', 'DELETE', '/roles/'.$unused, as: $owner)->assertNoContent();

        $log = AuditLog::query()->withoutGlobalScopes()->where('action', 'role.updated')->first();
        $this->assertSame(['nom' => 'Vendeur', 'permissions_retirees' => ['Vendre']], $log->old_values);
        $this->assertSame(['nom' => 'Vendeur', 'permissions_ajoutees' => ['Voir les crédits clients']], $log->new_values);
        $this->assertTrue(AuditLog::query()->withoutGlobalScopes()->where('action', 'role.deleted')->exists());
    }

    public function test_users_are_created_with_a_role_and_given_shops(): void
    {
        ['tenant' => $tenant, 'owner' => $owner, 'shop' => $shop] = $this->createTenant();
        $role = $tenant->run(fn () => Role::create(['name' => 'Vendeur']));
        $ownerRole = $tenant->run(fn () => Role::query()->where('is_owner', true)->value('id'));
        $payload = ['firstname' => 'Fatou', 'lastname' => 'Bamba', 'email' => '', 'phone' => '07 00 00 00 03', 'role_id' => $role->id];

        $this->api('kone', 'POST', '/users', $payload, as: $owner)->assertJsonPath('errors.password.0', 'Le mot de passe doit contenir au moins 8 caractères.');
        $this->api('kone', 'POST', '/users', [...$payload, 'password' => 'secret123', 'role_id' => $ownerRole], as: $owner)
            ->assertJsonPath('errors.role_id.0', 'Le rôle du propriétaire est réservé au créateur de l’espace.');
        $this->api('kone', 'POST', '/users', [...$payload, 'password' => 'secret123', 'phone' => '+225 07 00 00 00 01'], as: $owner)
            ->assertJsonPath('errors.phone.0', 'Ce numéro est déjà utilisé par un autre utilisateur.');

        $user = $this->api('kone', 'POST', '/users', [...$payload, 'password' => 'secret123'], as: $owner)
            ->assertCreated()->assertJsonPath('data.phone', '0700000003')->assertJsonPath('data.shops', [])->assertJsonPath('data.is_active', true)->json('data');
        $this->api('kone', 'PUT', "/users/{$user['id']}/shops", ['shop_ids' => [$shop->id]], as: $owner)->assertOk()->assertJsonPath('data.shops.0.id', $shop->id);

        $this->api('kone', 'POST', '/auth/login', ['login' => '0700000003', 'password' => 'secret123'])->assertOk()->assertJsonPath('data.shops.0.id', $shop->id);
        $changed = AuditLog::query()->withoutGlobalScopes()->where('action', 'user.shops_changed')->first();
        $this->assertSame(['boutiques' => ['Boutique principale']], $changed->new_values);
    }

    public function test_the_owner_account_is_protected_and_deactivation_ends_sessions(): void
    {
        ['tenant' => $tenant, 'owner' => $owner] = $this->createTenant();
        $manager = $this->createUser($tenant, ['users.manage']);
        $seller = $this->createUser($tenant, ['sales.view']);

        $this->api('kone', 'PATCH', "/users/{$owner->id}/status", ['is_active' => false], as: $manager)
            ->assertForbidden()->assertJsonPath('message', 'Le compte du propriétaire ne peut pas être désactivé.');
        $this->api('kone', 'PUT', "/users/{$owner->id}", ['firstname' => 'X', 'lastname' => 'Y', 'email' => 'x@example.ci', 'role_id' => $owner->role_id], as: $manager)
            ->assertForbidden()->assertJsonPath('message', 'Le compte du propriétaire ne peut pas être modifié par un autre utilisateur.');
        $this->api('kone', 'PATCH', "/users/{$manager->id}/status", ['is_active' => false], as: $manager)
            ->assertForbidden()->assertJsonPath('message', 'Vous ne pouvez pas désactiver votre propre compte.');

        $this->api('kone', 'GET', '/me', as: $seller)->assertOk();
        $this->api('kone', 'PATCH', "/users/{$seller->id}/status", ['is_active' => false], as: $manager)->assertOk()->assertJsonPath('data.is_active', false);
        $this->api('kone', 'GET', '/me', as: $seller->fresh())->assertUnauthorized();
        $this->assertTrue(AuditLog::query()->withoutGlobalScopes()->where('action', 'user.deactivated')->exists());
    }

    public function test_the_plan_limits_the_number_of_users(): void
    {
        ['tenant' => $tenant, 'owner' => $owner] = $this->createTenant(plan: 'Essentiel');
        $role = $tenant->run(fn () => Role::create(['name' => 'Vendeur']));
        $this->createUser($tenant, []);
        $this->createUser($tenant, []);

        $this->api('kone', 'POST', '/users', ['firstname' => 'A', 'lastname' => 'B', 'email' => 'ab@example.ci', 'role_id' => $role->id, 'password' => 'secret123'], as: $owner)
            ->assertUnprocessable()->assertJsonPath('errors.firstname.0', 'Votre abonnement permet 3 utilisateurs au maximum.');
    }
}
