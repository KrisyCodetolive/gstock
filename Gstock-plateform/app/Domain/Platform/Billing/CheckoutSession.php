<?php

namespace App\Domain\Platform\Billing;

/** Paiement créé chez GeniusPay : page où envoyer le commerçant et référence de la transaction. */
final class CheckoutSession
{
    public function __construct(
        public readonly string $url,
        /** Référence GeniusPay (MTX-…), null pour la simulation. */
        public readonly ?string $transactionId = null,
    ) {}
}
