<?php

namespace Tests\Feature;

use App\Domain\Identity\Models\User;
use App\Domain\Platform\Billing\GeniusPayWebhook;
use App\Domain\Platform\Models\Plan;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Platform\Models\TenantInvoice;
use App\Domain\Shops\Models\Shop;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/** Mon abonnement : factures, paiement GeniusPay validé par GeniusPay (webhook ou relecture), lecture seule (M00, ADR-003). */
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

    public function test_geniuspay_checkout_page_and_errors(): void
    {
        $this->useGeniusPay();
        $res = $this->checkout('Commerce')->assertCreated();
        $this->assertSame('https://geniuspay.ci/checkout/SANDBOX_1', $res->json('data.checkout_url'));
        $this->assertSame('SANDBOX_1', TenantInvoice::query()->where('reference', $res->json('data.invoice.reference'))->value('geniuspay_transaction_id'));
        Http::assertSent(fn ($r) => $r->method() === 'POST' && $r->url() === 'https://gp.test/api/v1/merchant/payments'
            && $r->header('X-API-Key') === ['sk_sandbox_key'] && $r->header('X-API-Secret') === ['ss_sandbox_secret']
            && $r['amount'] === 12000 && $r['metadata']['invoice'] === $res->json('data.invoice.reference')
            && $r['success_url'] === 'http://kone.localhost:5173/parametres/abonnement');

        // GeniusPay refuse : message clair, et la facture ne reste pas « en attente ».
        $this->useGeniusPay(initiate: Http::response(['success' => false, 'error' => ['code' => 'PAYMENT_INIT_FAILED', 'message' => 'x']], 400));
        $this->checkout('Commerce')->assertStatus(502)->assertJsonPath('message', 'Le paiement GeniusPay n’a pas pu être lancé. Réessayez dans un instant.');
        $this->api('kone', 'GET', '/subscription', as: $this->owner)->assertJsonPath('data.pending_invoice', null);
    }

    public function test_only_a_signed_and_confirmed_webhook_extends_the_subscription_once(): void
    {
        $this->useGeniusPay();
        $invoice = $this->checkout('Commerce')->json('data.invoice');
        $trialEnd = $this->tenant->subscription->fresh()->trial_ends_at;

        $this->webhook($this->event('payment.success', $invoice, 'SANDBOX_1'), signature: 'mauvaise')->assertStatus(401);
        $this->webhook($this->event('payment.success', $invoice, 'SANDBOX_1'), at: time() - 600)->assertStatus(401);
        $this->assertNull($this->tenant->subscription->fresh()->ends_at);

        // Événement sans conséquence, puis échec.
        $this->webhook($this->event('payment.initiated', $invoice, 'SANDBOX_1'))->assertOk()->assertJsonPath('status', 'pending');
        $this->webhook($this->event('payment.failed', $invoice, 'SANDBOX_1'))->assertOk()->assertJsonPath('status', 'failed');
        $this->assertNull($this->tenant->subscription->fresh()->ends_at);

        $this->useGeniusPay(reference: 'SANDBOX_2');
        $paid = $this->checkout('Réseau')->json('data.invoice');
        // Webhook d'un autre environnement : ignoré.
        $this->webhook($this->event('payment.success', $paid, 'SANDBOX_2', environment: 'live'))->assertOk()->assertJsonPath('status', 'pending');
        // GeniusPay ne confirme pas encore le paiement : rien ne change.
        $this->webhook($this->event('payment.success', $paid, 'SANDBOX_2'))->assertOk()->assertJsonPath('status', 'pending');

        $this->useGeniusPay(reference: 'SANDBOX_2', status: 'completed', amount: 25000);
        $this->webhook($this->event('payment.success', $paid, 'SANDBOX_2'))->assertOk()->assertJsonPath('status', 'paid');
        // Un mois de plus à partir de la fin de l'essai ; la formule payée devient celle de l'abonnement.
        $sub = $this->tenant->subscription->fresh();
        $this->assertSame($trialEnd->copy()->addMonthNoOverflow()->toDateTimeString(), $sub->ends_at->toDateTimeString());
        $this->assertSame('Réseau', $sub->plan->name);
        // Rejoué : rien ne change.
        $this->webhook($this->event('payment.success', $paid, 'SANDBOX_2'))->assertOk();
        $this->assertSame($sub->ends_at->toDateTimeString(), $this->tenant->subscription->fresh()->ends_at->toDateTimeString());
        $this->api('kone', 'GET', '/subscription/invoices', as: $this->owner)->assertJsonPath('data.0.payment_channel', 'Wave')->assertJsonPath('data.0.status', 'paid');
        $this->api('kone', 'GET', '/me', as: $this->owner)->assertJsonPath('data.tenant.subscription.status', 'active');
    }

    public function test_a_lower_amount_does_not_pay_the_invoice(): void
    {
        $this->useGeniusPay();
        $invoice = $this->checkout('Commerce')->json('data.invoice');
        $this->useGeniusPay(status: 'completed', amount: 500);
        $this->webhook($this->event('payment.success', $invoice, 'SANDBOX_1'))->assertOk()->assertJsonPath('status', 'pending');
        $this->assertNull($this->tenant->subscription->fresh()->ends_at);
    }

    public function test_returning_from_geniuspay_reads_the_payment_state(): void
    {
        $this->useGeniusPay();
        $this->checkout('Commerce');
        $this->api('kone', 'GET', '/subscription', as: $this->owner)->assertJsonPath('data.status', 'trial')->assertJsonPath('data.pending_invoice.status', 'pending');

        // Le webhook n'est pas arrivé, mais GeniusPay dit le paiement réussi : l'abonnement est prolongé.
        $this->useGeniusPay(status: 'completed', amount: 12000);
        $this->api('kone', 'GET', '/subscription', as: $this->owner)->assertJsonPath('data.status', 'trial'); // Relu il y a moins de 5 s.
        $this->travel(6)->seconds();
        $this->api('kone', 'GET', '/subscription', as: $this->owner)->assertJsonPath('data.status', 'active')->assertJsonPath('data.pending_invoice', null);
        Http::assertSent(fn ($r) => $r->method() === 'GET' && $r->url() === 'https://gp.test/api/v1/merchant/payments/SANDBOX_1');
    }

    public function test_a_suspended_space_is_read_only_but_can_pay(): void
    {
        $this->travel(5 + 7 + 1)->days(); // Fin de l'essai + délai de grâce.
        $this->api('kone', 'GET', '/me', as: $this->owner)->assertJsonPath('data.tenant.subscription.read_only', true);
        $this->api('kone', 'POST', '/products', ['name' => 'Riz', 'price' => '1000'], as: $this->owner)->assertStatus(402);
        $this->api('kone', 'GET', '/products', as: $this->owner)->assertOk();
        $this->api('kone', 'POST', '/onboarding/dismiss', as: $this->owner)->assertOk();

        $this->useGeniusPay();
        $invoice = $this->checkout('Commerce')->assertCreated()->json('data.invoice');
        $this->useGeniusPay(status: 'completed', amount: 12000);
        $this->webhook($this->event('payment.success', $invoice, 'SANDBOX_1'))->assertOk();
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

    /** Réponses de l'API marchand simulée (référence, statut, montant, refus du lancement). */
    private array $gp = [];

    /** Pilote GeniusPay réel, avec l'API marchand simulée par Http::fake. */
    private function useGeniusPay(string $reference = 'SANDBOX_1', string $status = 'pending', int $amount = 12000, mixed $initiate = null): void
    {
        $first = $this->gp === [];
        $this->gp = compact('reference', 'status', 'amount', 'initiate');
        if (! $first) {
            return;
        }
        config(['gstock.geniuspay.platform' => [...config('gstock.geniuspay.platform'),
            'driver' => 'geniuspay', 'base_url' => 'https://gp.test/api/v1/merchant', 'api_key' => 'sk_sandbox_key', 'api_secret' => 'ss_sandbox_secret']]);
        Http::preventStrayRequests();
        Http::fake([
            'gp.test/api/v1/merchant/payments' => fn () => $this->gp['initiate'] ?? Http::response(['success' => true, 'data' => [
                'id' => 1, 'reference' => $this->gp['reference'], 'amount' => $this->gp['amount'], 'status' => 'pending', 'environment' => 'sandbox',
                'checkout_url' => "https://geniuspay.ci/checkout/{$this->gp['reference']}",
            ]], 201),
            'gp.test/api/v1/merchant/payments/*' => fn () => Http::response(['success' => true, 'data' => [
                'reference' => $this->gp['reference'], 'amount' => $this->gp['amount'], 'status' => $this->gp['status'], 'payment_provider' => 'wave', 'environment' => 'sandbox',
            ]]),
        ]);
    }

    private function event(string $event, array $invoice, string $transaction, string $environment = 'sandbox'): array
    {
        return ['id' => (string) Str::uuid(), 'event' => $event, 'timestamp' => time(), 'environment' => $environment, 'data' => [
            'object' => 'transaction', 'reference' => $transaction, 'amount' => 12000.00, 'currency' => 'XOF', 'status' => 'completed',
            'payment_method' => 'mobile_money', 'provider' => 'wave', 'metadata' => ['invoice' => $invoice['reference'], 'tenant' => 'kone'],
        ]];
    }

    private function webhook(array $payload, ?string $signature = null, ?int $at = null): TestResponse
    {
        $body = json_encode($payload);
        $at ??= time();

        return $this->call('POST', 'http://'.self::DOMAIN.'/api/v1/webhooks/geniuspay/platform', [], [], [], [
            'CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json',
            'HTTP_X_WEBHOOK_TIMESTAMP' => (string) $at, 'HTTP_X_WEBHOOK_EVENT' => $payload['event'],
            'HTTP_X_WEBHOOK_SIGNATURE' => $signature ?? GeniusPayWebhook::sign($body, $at, config('gstock.geniuspay.platform.webhook_secret')),
        ], $body);
    }
}
