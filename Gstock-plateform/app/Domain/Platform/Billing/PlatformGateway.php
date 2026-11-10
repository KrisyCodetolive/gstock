<?php

namespace App\Domain\Platform\Billing;

use App\Domain\Platform\Models\TenantInvoice;

/**
 * Passerelle de paiement des abonnements (GeniusPay, clés de Genius Groups, ADR-003).
 * Elle lance le paiement et sait relire son état chez GeniusPay ; l'abonnement
 * n'est prolongé que sur une confirmation venue du serveur de GeniusPay, jamais
 * sur la seule redirection du navigateur.
 */
interface PlatformGateway
{
    /** Crée le paiement : adresse de la page de paiement, qui renvoie ensuite sur « Mon abonnement ». */
    public function checkout(TenantInvoice $invoice, string $returnUrl): CheckoutSession;

    /** État d'un paiement chez GeniusPay, ou null si ce pilote ne sait pas le relire. */
    public function find(string $transactionId): ?GatewayPayment;
}
