<?php

namespace App\Support;

use Stancl\Tenancy\Database\Concerns\BelongsToTenant as StanclBelongsToTenant;

/**
 * Donnée d'un espace (ADR-002) : `tenant_id` rempli à la création et filtre
 * automatique sur l'espace de la requête. Ne jamais lire ces tables sans espace,
 * sauf dans le back-office (withoutTenancy, journalisé).
 */
trait BelongsToTenant
{
    use StanclBelongsToTenant;
}
