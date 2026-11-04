<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Platform\Billing\SubscriptionService;
use App\Domain\Platform\Billing\WebhookSignature;
use App\Http\Controllers\Controller;
use App\Support\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Webhook GeniusPay de la plateforme (ADR-003) : seul ce message valide un paiement
 * d'abonnement. Signature vérifiée sur le corps brut ; traitement idempotent.
 */
class GeniusPayWebhookController extends Controller
{
    public function __construct(private SubscriptionService $subscriptions) {}

    public function platform(Request $request): JsonResponse
    {
        if (! WebhookSignature::valid($request->getContent(), $request->header(WebhookSignature::HEADER), config('gstock.geniuspay.platform.webhook_secret'))) {
            throw new ApiException(401, 'Signature du webhook invalide.');
        }
        $invoice = $this->subscriptions->applyWebhook((array) json_decode($request->getContent(), true));

        return response()->json(['data' => ['received' => true, 'status' => $invoice?->status]]);
    }
}
