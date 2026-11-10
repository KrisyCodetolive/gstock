<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Platform\Billing\GeniusPayWebhook;
use App\Domain\Platform\Billing\SubscriptionService;
use App\Http\Controllers\Controller;
use App\Support\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Webhook GeniusPay de la plateforme (ADR-003) : il valide les paiements
 * d'abonnement. Signature et fraîcheur vérifiées sur le corps brut ; traitement
 * idempotent (GeniusPay renvoie le message tant qu'il n'a pas reçu de 2xx).
 */
class GeniusPayWebhookController extends Controller
{
    public function __construct(private SubscriptionService $subscriptions) {}

    public function platform(Request $request): JsonResponse
    {
        $body = $request->getContent();
        if (! GeniusPayWebhook::valid($body, $request->header(GeniusPayWebhook::SIGNATURE), $request->header(GeniusPayWebhook::TIMESTAMP), config('gstock.geniuspay.platform.webhook_secret'))) {
            throw new ApiException(401, 'Signature du webhook invalide.');
        }
        $invoice = $this->subscriptions->handleWebhook((array) json_decode($body, true));

        return response()->json(['received' => true, 'status' => $invoice?->status]);
    }
}
