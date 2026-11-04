<?php

namespace Tests\Feature;

use App\Domain\Identity\Models\User;
use App\Domain\Platform\Billing\WebhookSignature;
use App\Domain\Platform\Models\Plan;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Shops\Models\Shop;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/** Mon abonnement : factures, paiement GeniusPay validé au webhook, lecture seule (M00, ADR-003). */
class SubscriptionTest extends TestCase
{
    private Tenant $tenant;

    private User $owner;

    private Shop $shop;

    protected function setUp(): void
    {
        parent::setUp();
        ['tenant' => $this->tenant, 'owner' => $this->owner, 'shop' => $this->shop] = $this->createTenant();
        // Essai en cours, rien de payé.
        $this->tenant->subscription->update(['trial_ends_at' => now()->addDays(5), 'ends_at' => null, 'status' => 'trial']);
    }

    public function test_subscription_page_and_checkout(): void
    {
        $this->api('kone', 'GET', '/subscription', as: $this->owner)->assertOk()
            ->assertJsonPath('status', null)->assertJsonPath('data.status', 'trial')->assertJsonPath('data.days_left', 5)
            ->assertJsonPath('data.plan.name', 'Commerce')->assertJsonPath('data.usage', ['shops' => 1, 'users' => 1, 'products' => 0])
            ->assertJsonPath('data.pending_invoice', null);

        $first = $this->checkout('Commerce')->assertCreated()->assertJsonPath('data.invoice.status', 'pending')->assertJsonPath('data.invoice.amount', '12000.00');
        $this->assertStringStartsWith('/api/v1/simulation/geniuspay/', $first->json('data.checkout_url'));
        // Un nouveau paiement remplace celui qui a été abandonné.
        $second = $this->checkout('Réseau')->json('data.invoice');
        $this->api('kone', 'GET', '/subscription/invoices', as: $this->owner)->assertJsonPath('meta.total', 2)
            ->assertJsonPath('data.0.reference', $second['reference'])->assertJsonPath('data.1.status', 'failed');
        $this->api('kone', 'GET', '/subscription', as: $this->owner)->assertJsonPath('data.pending_invoice.plan_name', 'Réseau');

        // Une formule plus petite doit contenir l'utilisation actuelle.
        $this->api('kone', 'POST', '/shops', ['name' => 'Deuxième', 'city' => 'Abidjan'], as: $this->owner)->assertCreated();
        $this->checkout('Essentiel')->assertUnprocessable()
            ->assertJsonPath('errors.plan_id.0', 'Vous avez 2 boutiques ouvertes (cette formule en permet 1). Réduisez-les avant de choisir cette formule.');
        $this->api('kone', 'GET', '/subscription', as: $this->createUser($this->tenant, ['sales.create'], [$this->shop]))->assertForbidden();
    }

    public function test_only_a_signed_webhook_extends_the_subscription_once(): void
    {
        $invoice = $this->checkout('Commerce')->json('data.invoice');
        $trialEnd = $this->tenant->subscription->fresh()->trial_ends_at;

        $this->webhook(['event' => 'payment.succeeded', 'data' => ['reference' => $invoice['reference']]], 'mauvaise-signature')->assertStatus(401);
        $this->assertNull($this->tenant->subscription->fresh()->ends_at);

        $this->webhook(['event' => 'payment.failed', 'data' => ['reference' => $invoice['reference'], 'channel' => 'Wave']])->assertOk()->assertJsonPath('data.status', 'failed');
        $this->assertNull($this->tenant->subscription->fresh()->ends_at);

        $paid = $this->checkout('Réseau')->json('data.invoice');
        $payload = ['event' => 'payment.succeeded', 'data' => ['reference' => $paid['reference'], 'transaction_id' => 'GP-42', 'channel' => 'Orange Money']];
        $this->webhook($payload)->assertOk()->assertJsonPath('data.status', 'paid');
        // Un mois de plus à partir de la fin de l'essai ; la formule payée devient celle de l'abonnement.
        $sub = $this->tenant->subscription->fresh();
        $this->assertSame($trialEnd->copy()->addMonthNoOverflow()->toDateTimeString(), $sub->ends_at->toDateTimeString());
        $this->assertSame('Réseau', $sub->plan->name);
        // Rejoué : rien ne change.
        $this->webhook($payload)->assertOk();
        $this->assertSame($sub->ends_at->toDateTimeString(), $this->tenant->subscription->fresh()->ends_at->toDateTimeString());
        $this->api('kone', 'GET', '/subscription/invoices', as: $this->owner)->assertJsonPath('data.0.payment_channel', 'Orange Money')->assertJsonPath('data.0.status', 'paid');
        $this->api('kone', 'GET', '/me', as: $this->owner)->assertJsonPath('data.tenant.subscription.status', 'active');
    }

    public function test_a_suspended_space_is_read_only_but_can_pay(): void
    {
        $this->travel(5 + 7 + 1)->days(); // Fin de l'essai + délai de grâce.
        $this->api('kone', 'GET', '/me', as: $this->owner)->assertJsonPath('data.tenant.subscription.read_only', true);
        $this->api('kone', 'POST', '/products', ['name' => 'Riz', 'price' => '1000'], as: $this->owner)->assertStatus(402);
        $this->api('kone', 'GET', '/products', as: $this->owner)->assertOk();
        $this->api('kone', 'POST', '/onboarding/dismiss', as: $this->owner)->assertOk();

        $invoice = $this->checkout('Commerce')->assertCreated()->json('data.invoice');
        $this->webhook(['event' => 'payment.succeeded', 'data' => ['reference' => $invoice['reference']]])->assertOk();
        // Payé : un mois à partir d'aujourd'hui, l'espace s'ouvre à nouveau.
        $this->assertTrue($this->tenant->subscription->fresh()->ends_at->between(now()->addMonth()->subMinute(), now()->addMonth()->addMinute()));
        $this->api('kone', 'POST', '/products', ['name' => 'Riz', 'price' => '1000'], as: $this->owner)->assertCreated();
    }

    public function test_the_simulated_payment_page(): void
    {
        $url = $this->checkout('Commerce')->json('data.checkout_url');
        $this->get('http://kone.'.self::DOMAIN.$url)->assertOk()->assertSee('Payer avec Wave')->assertSee('12 000 FCFA');
        $this->get('http://kone.'.self::DOMAIN.preg_replace('/signature=\w+/', 'signature=faux', $url))->assertForbidden();

        $html = $this->get('http://kone.'.self::DOMAIN.$url)->getContent();
        preg_match('#href="([^"]+channel=Wave[^"]*outcome=success[^"]*|[^"]+outcome=success[^"]*channel=Wave[^"]*)"#', $html, $m);
        $this->get('http://kone.'.self::DOMAIN.html_entity_decode($m[1]))->assertRedirect('http://kone.localhost:5173/parametres/abonnement');
        $this->api('kone', 'GET', '/subscription', as: $this->owner)->assertJsonPath('data.status', 'active')->assertJsonPath('data.pending_invoice', null);
    }

    private function checkout(string $plan): TestResponse
    {
        return $this->api('kone', 'POST', '/subscription/checkout', ['plan_id' => Plan::query()->where('name', $plan)->value('id')], as: $this->owner);
    }

    private function webhook(array $payload, ?string $signature = null): TestResponse
    {
        $body = json_encode($payload);

        return $this->call('POST', 'http://'.self::DOMAIN.'/api/v1/webhooks/geniuspay/platform', [], [], [], [
            'CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json',
            'HTTP_X_GENIUSPAY_SIGNATURE' => $signature ?? WebhookSignature::sign($body, config('gstock.geniuspay.platform.webhook_secret')),
        ], $body);
    }
}
