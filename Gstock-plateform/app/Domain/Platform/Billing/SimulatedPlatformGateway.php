<?php

namespace App\Domain\Platform\Billing;

use App\Domain\Platform\Models\TenantInvoice;
use Illuminate\Support\Facades\URL;

/**
 * Page de paiement simulée (développement, démonstration) : elle joue le rôle de
 * GeniusPay et confirme le paiement côté serveur, comme le ferait le webhook.
 * Jamais utilisée en production (voir AppServiceProvider).
 */
final class SimulatedPlatformGateway implements PlatformGateway
{
    public function checkout(TenantInvoice $invoice, string $returnUrl): CheckoutSession
    {
        // Lien signé et relatif : il passe par le même hôte que l'application (proxy en développement).
        return new CheckoutSession(URL::temporarySignedRoute('geniuspay.simulation', now()->addHour(), ['invoice' => $invoice->id, 'return' => $returnUrl], absolute: false));
    }

    public function find(string $transactionId): ?GatewayPayment
    {
        return null;
    }
}
