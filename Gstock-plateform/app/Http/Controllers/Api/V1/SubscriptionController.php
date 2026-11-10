<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Platform\Billing\SubscriptionService;
use App\Domain\Platform\CurrentTenant;
use App\Domain\Platform\Models\TenantInvoice;
use App\Http\Controllers\Controller;
use App\Support\ListQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Mon abonnement (M00) : formule, échéances, utilisation, factures, paiement GeniusPay. */
class SubscriptionController extends Controller
{
    public function __construct(private SubscriptionService $subscriptions) {}

    public function show(): JsonResponse
    {
        // Retour de la page de paiement : l'état est relu chez GeniusPay si le webhook n'est pas encore arrivé.
        $this->subscriptions->refreshPending(CurrentTenant::get());

        return response()->json(['data' => $this->subscriptions->resource(CurrentTenant::get())]);
    }

    public function invoices(Request $request): JsonResponse
    {
        $query = TenantInvoice::query()->with('plan')->where('tenant_id', CurrentTenant::get()->id)->orderByDesc('created_at')->orderByDesc('id');

        return ListQuery::respond($request, $query, SubscriptionService::invoice(...));
    }

    /** Permis même en lecture seule : c'est ce qui permet d'en sortir. */
    public function checkout(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->subscriptions->checkout(CurrentTenant::get(), $request->input('plan_id'))], 201);
    }
}
