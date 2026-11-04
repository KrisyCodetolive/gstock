<?php

namespace App\Http\Middleware;

use App\Support\ApiException;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Contrôle serveur des permissions (§6.2) : `permission:a,b` laisse passer si
 * le rôle accorde au moins l'une d'elles. L'interface masque, le serveur refuse.
 */
class RequirePermission
{
    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        if (! $request->user()?->hasAnyPermission(...$permissions)) {
            throw ApiException::forbidden();
        }

        return $next($request);
    }
}
