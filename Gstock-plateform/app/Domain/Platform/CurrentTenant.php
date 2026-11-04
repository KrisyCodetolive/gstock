<?php

namespace App\Domain\Platform;

use App\Domain\Platform\Models\Plan;
use App\Domain\Platform\Models\Tenant;
use RuntimeException;

/** Accès à l'espace de la requête (identifié par le sous-domaine) et à son abonnement. */
final class CurrentTenant
{
    public static function get(): Tenant
    {
        $tenant = tenant();
        if (! $tenant instanceof Tenant) {
            throw new RuntimeException('Aucun espace initialisé pour cette requête.');
        }

        return $tenant;
    }

    public static function state(): SubscriptionState
    {
        return self::get()->subscription->state();
    }

    /** Plan en cours : ses limites s'appliquent aux boutiques, utilisateurs et produits (M00). */
    public static function plan(): Plan
    {
        return self::get()->subscription->plan;
    }
}
