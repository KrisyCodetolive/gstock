<?php

namespace App\Domain\Platform\Billing;

use App\Domain\Platform\Models\TenantInvoice;

/**
 * Passerelle de paiement des abonnements (GeniusPay, clés de Genius Groups, ADR-003).
 * Elle ne fait que lancer le paiement : l'abonnement n'est prolongé qu'au webhook.
 */
interface PlatformGateway
{
    /** Adresse de la page de paiement, qui renvoie ensuite sur « Mon abonnement ». */
    public function checkoutUrl(TenantInvoice $invoice, string $returnUrl): string;
}
