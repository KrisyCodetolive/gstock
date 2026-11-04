<?php

namespace App\Http\Middleware;

use App\Domain\Platform\CurrentTenant;
use App\Support\ApiException;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Espace suspendu pour impayé : consultation seulement (M00). Toute écriture est
 * refusée en 402, sauf ce qui permet d'en sortir (abonnement, déconnexion).
 */
class EnsureTenantIsWritable
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->isMethodSafe() && CurrentTenant::state()->readOnly) {
            throw new ApiException(402, "Votre abonnement est suspendu : l'espace est en lecture seule. Réglez l'abonnement pour enregistrer à nouveau des opérations.");
        }

        return $next($request);
    }
}
