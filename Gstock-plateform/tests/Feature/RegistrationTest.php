<?php

namespace Tests\Feature;

use App\Domain\Platform\Models\Plan;
use App\Domain\Platform\Models\Tenant;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/** Inscription sur le domaine principal, lien de connexion, assistant de démarrage (M00). */
class RegistrationTest extends TestCase
{
    public function test_plans_and_slug_check(): void
    {
        $this->central('GET', '/plans')->assertOk()->assertJsonCount(3, 'data')
            ->assertJsonPath('data.1', fn ($p) => $p['name'] === 'Commerce' && $p['price'] === '12000.00' && $p['is_recommended'] && $p['trial_days'] === 14);
        $this->createTenant('alimentation-kone');

        $this->central('GET', '/register/check-slug?slug=boutique-awa')->assertJsonPath('data', ['available' => true, 'message' => null, 'suggestion' => null]);
        $this->central('GET', '/register/check-slug?slug=alimentation-kone')->assertJsonPath('data.available', false)
            ->assertJsonPath('data.message', 'Cette adresse est déjà prise par un autre commerce.')->assertJsonPath('data.suggestion', 'alimentation-kone-2');
        $this->central('GET', '/register/check-slug?slug=admin')->assertJsonPath('data.message', 'Cette adresse est réservée. Choisissez-en une autre.');
        $this->central('GET', '/register/check-slug?slug=Chez%20Awa')->assertJsonPath('data.message', 'Utilisez seulement des lettres minuscules sans accent, des chiffres et des tirets.')
            ->assertJsonPath('data.suggestion', 'chez-awa');
        $this->central('GET', '/register/check-slug?slug=ab')->assertJsonPath('data.message', "L'adresse doit faire entre 3 et 30 caractères.");
    }

    public function test_registration_creates_a_ready_space_opened_by_a_single_use_link(): void
    {
        $this->central('POST', '/register', ['slug' => 'Mauvaise adresse', 'phone' => '123', 'email' => 'x', 'password' => 'court'])->assertUnprocessable()
            ->assertJsonPath('errors.tenant_name.0', 'Saisissez le nom de votre commerce.')
            ->assertJsonPath('errors.slug.0', 'Utilisez seulement des lettres minuscules sans accent, des chiffres et des tirets.')
            ->assertJsonPath('errors.shop_city.0', 'Indiquez la ville de la boutique.')
            ->assertJsonPath('errors.phone.0', 'Saisissez un numéro à 10 chiffres, par exemple 07 00 00 00 00.')
            ->assertJsonPath('errors.email.0', 'Saisissez une adresse e-mail valide.')
            ->assertJsonPath('errors.password.0', 'Le mot de passe doit faire au moins 8 caractères.')
            ->assertJsonPath('errors.plan_id.0', 'Choisissez une formule.');
        $this->assertSame(0, Tenant::query()->count());

        $res = $this->central('POST', '/register', $this->payload())->assertCreated()
            ->assertJsonPath('data.tenant', ['name' => 'Boutique Awa', 'slug' => 'boutique-awa', 'url' => 'http://boutique-awa.localhost:5173']);
        $this->assertStringStartsWith('http://boutique-awa.localhost:5173/connexion/lien?jeton=', $res->json('data.login_url'));
        $token = substr($res->json('data.login_url'), strpos($res->json('data.login_url'), '=') + 1);

        // Provisionnement : propriétaire, boutique, référentiels par défaut, essai de 14 jours.
        $tenant = Tenant::query()->where('slug', 'boutique-awa')->firstOrFail();
        $this->assertSame('trial', $tenant->status);
        $this->assertTrue($tenant->subscription->trial_ends_at->between(now()->addDays(14)->subMinute(), now()->addDays(14)->addMinute()));
        $tenant->run(function () {
            $this->assertSame(['Boutique Cocody'], DB::table('shops')->pluck('name')->all());
            $this->assertSame(3, DB::table('payment_methods')->count());
            $this->assertSame(6, DB::table('expense_categories')->count());
        });
        $this->central('POST', '/register', $this->payload())->assertJsonPath('errors.slug.0', 'Cette adresse est déjà prise par un autre commerce.');

        // Le lien n'ouvre que son espace, une seule fois.
        $this->createTenant('autre', email: 'b@example.ci');
        $this->api('autre', 'POST', '/auth/token-login', ['token' => $token])->assertUnprocessable();
        $this->api('boutique-awa', 'POST', '/auth/token-login', ['token' => $token])->assertOk()
            ->assertJsonPath('data.user.firstname', 'Awa')->assertJsonPath('data.tenant.subscription.status', 'trial')->assertJsonPath('data.tenant.subscription.days_left', 14);
        $this->api('boutique-awa', 'GET', '/me')->assertOk();
        $this->api('boutique-awa', 'POST', '/auth/token-login', ['token' => $token])
            ->assertJsonPath('message', 'Ce lien de connexion a expiré ou a déjà servi. Connectez-vous avec votre e-mail et votre mot de passe.');
        // Connexion ordinaire avec le mot de passe choisi.
        $this->app['auth']->forgetGuards();
        $this->api('boutique-awa', 'POST', '/auth/login', ['login' => 'awa@example.ci', 'password' => 'motdepasse'])->assertOk();
    }

    public function test_an_expired_login_link_is_refused(): void
    {
        $url = $this->central('POST', '/register', $this->payload())->json('data.login_url');
        $this->travel(11)->minutes();
        $this->api('boutique-awa', 'POST', '/auth/token-login', ['token' => substr($url, strpos($url, '=') + 1)])->assertUnprocessable();
    }

    public function test_onboarding_steps_tick_themselves_and_can_be_skipped(): void
    {
        ['tenant' => $tenant, 'owner' => $owner, 'shop' => $shop] = $this->createTenant();
        $steps = fn () => collect($this->api('kone', 'GET', '/onboarding', as: $owner)->assertOk()->json('data.steps'))->keyBy('id');

        $this->assertFalse($steps()['products']['done']);
        $this->api('kone', 'POST', '/onboarding/steps/opening_balances/skip', as: $owner)->assertOk()
            ->assertJsonPath('data.steps.1', ['id' => 'opening_balances', 'done' => false, 'skipped' => true])->assertJsonPath('data.completed', false);
        $this->api('kone', 'POST', '/onboarding/steps/inconnue/skip', as: $owner)->assertNotFound();

        $product = $this->api('kone', 'POST', '/products', ['name' => 'Riz', 'price' => '1000', 'initial_quantity' => '5', 'shop_id' => $shop->id], as: $owner)->json('data.id');
        $this->assertTrue($steps()['products']['done']);
        $this->assertNotNull($tenant->fresh()->activated_at);
        $cash = $tenant->run(fn () => DB::table('payment_methods')->where('type', 'cash')->value('id'));
        $this->api('kone', 'POST', "/shops/{$shop->id}/sales", ['items' => [['product_id' => $product, 'quantity' => '1']], 'payments' => [['payment_method_id' => $cash, 'amount' => '1000']]], as: $owner)->assertCreated();
        $this->api('kone', 'GET', '/onboarding', as: $owner)->assertJsonPath('data.completed', true)->assertJsonPath('data.steps.2.done', true);
        $this->assertNotNull($tenant->fresh()->first_sale_at);

        $this->api('kone', 'POST', '/onboarding/dismiss', as: $owner)->assertJsonPath('data.dismissed', true);
        $seller = $this->createUser($tenant, ['subscription.manage'], [$shop]);
        $this->api('kone', 'GET', '/onboarding', as: $seller)->assertForbidden();
    }

    private function payload(): array
    {
        return [
            'tenant_name' => 'Boutique Awa', 'slug' => 'boutique-awa', 'shop_name' => 'Boutique Cocody', 'shop_city' => 'Abidjan',
            'firstname' => 'Awa', 'lastname' => 'Koné', 'phone' => '07 00 00 00 09', 'email' => 'AWA@example.ci', 'password' => 'motdepasse',
            'plan_id' => Plan::query()->where('name', 'Commerce')->value('id'),
        ];
    }

    private function central(string $method, string $uri, array $data = []): TestResponse
    {
        return $this->json($method, 'http://'.self::DOMAIN.'/api/v1'.$uri, $data);
    }
}
