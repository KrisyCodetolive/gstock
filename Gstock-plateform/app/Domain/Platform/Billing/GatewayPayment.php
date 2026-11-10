<?php

namespace App\Domain\Platform\Billing;

/** État d'un paiement d'abonnement, quelle que soit sa source (webhook, relecture, simulation). */
final class GatewayPayment
{
    public const PAID = 'paid';

    public const FAILED = 'failed';

    public function __construct(
        /** paid | failed | null (encore en cours). */
        public readonly ?string $outcome,
        public readonly ?string $transactionId = null,
        /** Moyen choisi sur la page de paiement (Wave, Orange Money…). */
        public readonly ?string $channel = null,
        /** Montant payé en FCFA, quand GeniusPay le donne. */
        public readonly ?string $amount = null,
    ) {}
}
