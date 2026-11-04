<?php

namespace App\Domain\Platform\Billing;

use App\Domain\Platform\Models\TenantInvoice;
use Illuminate\Support\Facades\URL;

/**
 * Page de paiement simulée (développement, démonstration) : elle joue le rôle de
 * GeniusPay et envoie un webhook signé, comme le ferait le vrai service.
 * Jamais utilisée en production (voir AppServiceProvider).
 */
final class SimulatedPlatformGateway implements PlatformGateway
{
    public function checkoutUrl(TenantInvoice $invoice, string $returnUrl): string
    {
        // Lien signé et relatif : il passe par le même hôte que l'application (proxy en développement).
        return URL::temporarySignedRoute('geniuspay.simulation', now()->addHour(), ['invoice' => $invoice->id, 'return' => $returnUrl], absolute: false);
    }
}
