<?php

namespace Tests\Feature;

use App\Domain\Audit\Models\AuditLog;
use App\Domain\Shops\Models\TenantPaymentSetting;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** Boutiques, paramètres de l'espace et clés GeniusPay (M03). */
class ShopsAndSettingsTest extends TestCase
{
    public function test_shops_are_created_unique_limited_by_the_plan_and_never_all_closed(): void
    {
        ['owner' => $owner, 'shop' => $shop] = $this->createTenant(plan: 'Essentiel');

        $this->api('kone', 'POST', '/shops', ['name' => '', 'city' => ''], as: $owner)
            ->assertJsonPath('errors.name.0', 'Donnez un nom à la boutique.')->assertJsonPath('errors.city.0', 'Indiquez la ville de la boutique.');
        $this->api('kone', 'POST', '/shops', ['name' => 'Boutique principale', 'city' => 'Abidjan'], as: $owner)
            ->assertJsonPath('errors.name.0', 'Une autre boutique porte déjà ce nom.');
        $this->api('kone', 'POST', '/shops', ['name' => 'Boutique Yopougon', 'city' => 'Abidjan'], as: $owner)
            ->assertJsonPath('errors.name.0', 'Votre abonnement permet 1 boutiques ouvertes au maximum.');
        // Une boutique fermée ne compte pas dans la limite.
        $closed = $this->api('kone', 'POST', '/shops', ['name' => 'Boutique Yopougon', 'city' => 'Abidjan', 'is_active' => false], as: $owner)->assertCreated()->json('data');
        $this->assertSame(1, $closed['users_count']);

        $this->api('kone', 'PUT', '/shops/'.$shop->id, ['name' => 'Boutique principale', 'city' => 'Abidjan', 'is_active' => false], as: $owner)
            ->assertJsonPath('errors.is_active.0', 'Gardez au moins une boutique ouverte.');
        $this->api('kone', 'PUT', '/shops/'.$shop->id, ['name' => 'Boutique Cocody', 'city' => 'Abidjan', 'district' => ' Angré ', 'auto_print_receipt' => true], as: $owner)
            ->assertOk()->assertJsonPath('data.name', 'Boutique Cocody')->assertJsonPath('data.district', 'Angré')->assertJsonPath('data.auto_print_receipt', true);
        $this->api('kone', 'DELETE', '/shops/'.$shop->id, as: $owner)->assertStatus(405);

        // Une boutique fermée disparaît du sélecteur.
        $this->assertSame([$shop->id], array_column($this->api('kone', 'GET', '/me', as: $owner)->json('data.shops'), 'id'));
    }

    public function test_settings_are_updated(): void
    {
        ['tenant' => $tenant, 'owner' => $owner] = $this->createTenant();

        $this->api('kone', 'PUT', '/settings', ['name' => '', 'email' => 'x'], as: $owner)
            ->assertJsonPath('errors.name.0', 'Donnez un nom à votre commerce.')->assertJsonPath('errors.email.0', "Cette adresse e-mail n'est pas valide.");
        $this->api('kone', 'PUT', '/settings', ['name' => 'Alimentation Koné', 'phone' => '0700000001', 'timezone' => 'Africa/Abidjan', 'receipt_footer' => 'Merci !', 'advanced_mode' => true], as: $owner)
            ->assertOk()
            ->assertJsonPath('data.name', 'Alimentation Koné')
            ->assertJsonPath('data.advanced_mode', true)
            ->assertJsonPath('data.plan', ['name' => 'Commerce', 'max_shops' => 3, 'max_users' => 10, 'max_products' => 2000]);
        $this->assertSame('Alimentation Koné', $tenant->fresh()->name);
        $this->api('kone', 'GET', '/me', as: $owner)->assertJsonPath('data.tenant.advanced_mode', true);
    }

    public function test_payment_keys_are_encrypted_and_never_returned(): void
    {
        ['tenant' => $tenant, 'owner' => $owner] = $this->createTenant();

        $this->api('kone', 'GET', '/settings/payment', as: $owner)->assertOk()
            ->assertJsonPath('data.api_key_hint', null)->assertJsonPath('data.updated_at', null);
        $this->api('kone', 'PUT', '/settings/payment', ['is_sandbox' => true, 'is_active' => true], as: $owner)
            ->assertJsonPath('errors.api_key.0', 'Saisissez la clé API pour activer les paiements en ligne.')
            ->assertJsonPath('errors.api_secret.0', 'Saisissez la clé secrète pour activer les paiements en ligne.');

        $this->travel(1)->minutes();
        $response = $this->api('kone', 'PUT', '/settings/payment', ['api_key' => 'pk_test_abcd1234', 'api_secret' => 'sk_test_secret', 'is_sandbox' => true, 'is_active' => true], as: $owner)->assertOk();
        $response->assertJsonPath('data.api_key_hint', '•••• 1234')->assertJsonPath('data.has_api_secret', true)->assertJsonPath('data.is_active', true);
        $this->assertStringNotContainsString('sk_test_secret', $response->getContent());
        $this->assertStringNotContainsString('pk_test_abcd1234', $response->getContent());
        $this->assertNotNull($response->json('data.updated_at'));

        // Une clé laissée vide garde la clé enregistrée.
        $this->api('kone', 'PUT', '/settings/payment', ['api_key' => '', 'is_sandbox' => false, 'is_active' => true], as: $owner)->assertJsonPath('data.api_key_hint', '•••• 1234');

        $raw = DB::table('tenant_payment_settings')->where('tenant_id', $tenant->id)->first();
        $this->assertStringNotContainsString('sk_test_secret', $raw->api_secret);
        $this->assertSame('sk_test_secret', $tenant->run(fn () => TenantPaymentSetting::query()->first()->api_secret));

        $this->api('kone', 'POST', '/settings/payment/test', as: $owner)->assertJsonPath('data.ok', true);
        $log = AuditLog::query()->withoutGlobalScopes()->where('action', 'payment_settings.updated')->latest('id')->first();
        $this->assertStringNotContainsString('sk_test', json_encode($log->new_values));
    }

    public function test_a_suspended_space_is_read_only(): void
    {
        ['tenant' => $tenant, 'owner' => $owner] = $this->createTenant();
        // Essai et période payée terminés depuis plus que le délai de grâce.
        $tenant->subscription->update(['trial_ends_at' => now()->subDays(40), 'ends_at' => now()->subDays(10)]);

        $this->api('kone', 'POST', '/auth/login', ['login' => 'owner@example.ci', 'password' => 'secret123'])
            ->assertOk()->assertJsonPath('data.tenant.subscription.read_only', true)->assertJsonPath('data.tenant.subscription.tenant_status', 'suspended');
        $this->api('kone', 'GET', '/settings')->assertOk();
        $this->api('kone', 'PUT', '/settings', ['name' => 'Nouveau nom'])->assertStatus(402)
            ->assertJsonPath('message', "Votre abonnement est suspendu : l'espace est en lecture seule. Réglez l'abonnement pour enregistrer à nouveau des opérations.");
        $this->api('kone', 'POST', '/auth/logout')->assertNoContent();
    }

    public function test_grace_period_keeps_the_space_writable(): void
    {
        ['tenant' => $tenant, 'owner' => $owner] = $this->createTenant();
        $tenant->subscription->update(['trial_ends_at' => now()->subDays(40), 'ends_at' => now()->subDays(2)]);

        $this->api('kone', 'GET', '/me', as: $owner)
            ->assertJsonPath('data.tenant.subscription', ['status' => 'past_due', 'tenant_status' => 'active', 'read_only' => false, 'days_left' => 5]);
        $this->api('kone', 'PUT', '/settings', ['name' => 'Toujours ouvert'], as: $owner)->assertOk();
    }

    public function test_the_audit_log_shows_space_actions_to_the_owner_only(): void
    {
        ['tenant' => $tenant, 'owner' => $owner, 'shop' => $shop] = $this->createTenant();
        $manager = $this->createUser($tenant, ['audit.view', 'roles.manage'], [$shop]);
        $this->api('kone', 'POST', '/roles', ['name' => 'Vendeur', 'permissions' => ['sales.view']], as: $manager)->assertCreated();

        $this->api('kone', 'GET', '/audit-logs', as: $owner)->assertOk()
            ->assertJsonPath('data.0.action', 'role.created')
            ->assertJsonPath('data.0.subject.label', 'Vendeur')
            ->assertJsonPath('data.0.new_values.permissions', ['Voir les ventes'])
            ->assertJsonPath('meta.total', 1);
        $this->api('kone', 'GET', '/audit-logs', as: $manager)->assertOk()->assertJsonPath('meta.total', 0);
        $this->api('kone', 'GET', '/audit-logs?filter[domain]=user', as: $owner)->assertJsonPath('meta.total', 0);
    }
}
