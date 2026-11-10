<?php

namespace App\Domain\Platform\Billing;

use App\Domain\Platform\Models\TenantInvoice;
use App\Support\ApiException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Pilote GeniusPay réel (API marchand, https://pay.genius.ci/docs/api) : paiement en
 * mode « checkout » (le commerçant choisit Wave, Orange Money, MTN, Moov ou la carte
 * sur la page de GeniusPay), puis relecture de l'état par la référence MTX-….
 */
final class GeniusPayPlatformGateway implements PlatformGateway
{
    public function __construct(
        private string $baseUrl,
        private string $apiKey,
        private string $apiSecret,
    ) {}

    public static function fromConfig(): self
    {
        $c = config('gstock.geniuspay.platform');
        if (blank($c['api_key']) || blank($c['api_secret'])) {
            throw new \RuntimeException('Clés GeniusPay manquantes : renseignez GENIUSPAY_API_KEY et GENIUSPAY_API_SECRET.');
        }

        return new self(rtrim((string) $c['base_url'], '/'), (string) $c['api_key'], (string) $c['api_secret']);
    }

    /** sandbox ou live, d'après le préfixe des clés (sk_sandbox_…, sk_live_…). */
    public static function environment(): string
    {
        $c = config('gstock.geniuspay.platform');

        return str_contains((string) $c['api_key'].(string) $c['api_secret'], '_live_') ? 'live' : 'sandbox';
    }

    public function checkout(TenantInvoice $invoice, string $returnUrl): CheckoutSession
    {
        $invoice->loadMissing(['plan', 'tenant']);
        $response = $this->send(fn (PendingRequest $http) => $http->post('/payments', [
            'amount' => (int) round((float) $invoice->amount),
            'currency' => 'XOF',
            'description' => "Abonnement GStock {$invoice->plan->name} ({$invoice->tenant->name}), facture {$invoice->reference}",
            'customer' => ['name' => $invoice->tenant->name],
            'success_url' => $returnUrl,
            'error_url' => $returnUrl,
            'metadata' => ['invoice' => $invoice->reference, 'tenant' => $invoice->tenant->slug],
        ]));

        $url = $response['checkout_url'] ?? $response['payment_url'] ?? null;
        if (! $url || empty($response['reference'])) {
            Log::error('GeniusPay : réponse de paiement incomplète.', ['invoice' => $invoice->reference, 'response' => $response]);
            throw self::unavailable();
        }

        return new CheckoutSession((string) $url, (string) $response['reference']);
    }

    public function find(string $transactionId): ?GatewayPayment
    {
        $data = $this->send(fn (PendingRequest $http) => $http->get('/payments/'.rawurlencode($transactionId)));

        return new GatewayPayment(
            self::outcome($data['status'] ?? null),
            (string) ($data['reference'] ?? $transactionId),
            self::channel($data['payment_provider'] ?? $data['payment_method'] ?? null),
            isset($data['amount']) ? (string) $data['amount'] : null,
        );
    }

    /** Événements utiles aux abonnements. */
    public const WEBHOOK_EVENTS = ['payment.success', 'payment.failed', 'payment.cancelled', 'payment.expired'];

    /** Webhooks déclarés sur le compte GeniusPay. */
    public function webhooks(): array
    {
        return $this->send(fn (PendingRequest $http) => $http->get('/webhooks'));
    }

    /** Déclare un webhook ; la réponse contient son secret (whsec_…), donné une seule fois. */
    public function createWebhook(string $url): array
    {
        return $this->send(fn (PendingRequest $http) => $http->post('/webhooks', ['name' => 'GStock abonnements', 'url' => $url, 'events' => self::WEBHOOK_EVENTS]));
    }

    /** Statut GeniusPay → issue du paiement : seuls « completed » et les échecs définitifs comptent. */
    public static function outcome(?string $status): ?string
    {
        return match ($status) {
            'completed' => GatewayPayment::PAID,
            'failed', 'cancelled', 'expired' => GatewayPayment::FAILED,
            default => null,
        };
    }

    /** Nom affiché du moyen de paiement. */
    public static function channel(?string $code): ?string
    {
        if (blank($code)) {
            return null;
        }

        return match ($code) {
            'wave' => 'Wave',
            'orange_money' => 'Orange Money',
            'mtn_money', 'mtn_momo' => 'MTN Money',
            'moov_money' => 'Moov Money',
            'card', 'paystack' => 'Carte bancaire',
            'mobile_money', 'pawapay' => 'Mobile Money',
            default => ucfirst(str_replace('_', ' ', $code)),
        };
    }

    /** Appel à l'API marchand ; renvoie `data`, ou lève une erreur lisible par le commerçant. */
    private function send(callable $call): array
    {
        $http = Http::baseUrl($this->baseUrl)
            ->withHeaders(['X-API-Key' => $this->apiKey, 'X-API-Secret' => $this->apiSecret])
            ->acceptJson()->asJson()->timeout(20)->connectTimeout(10);

        try {
            $response = $call($http);
        } catch (ConnectionException $e) {
            Log::error('GeniusPay injoignable.', ['error' => $e->getMessage()]);
            throw self::unavailable();
        }
        if (! $response->successful() || $response->json('success') === false) {
            Log::error('GeniusPay a refusé la requête.', ['status' => $response->status(), 'error' => $response->json('error') ?? $response->body()]);
            throw self::unavailable();
        }

        return (array) $response->json('data');
    }

    private static function unavailable(): ApiException
    {
        return new ApiException(502, 'Le paiement GeniusPay n’a pas pu être lancé. Réessayez dans un instant.');
    }
}
