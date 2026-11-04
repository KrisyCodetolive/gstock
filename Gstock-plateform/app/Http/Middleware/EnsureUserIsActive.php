<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Un utilisateur désactivé perd ses sessions en cours (§6.2). Par sécurité, un
 * compte n'est jamais accepté sur le sous-domaine d'un autre espace (ADR-002).
 * Une session du mode support se termine à l'heure prévue.
 */
class EnsureUserIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user && (! $user->is_active || $user->tenant_id !== tenant('id'))) {
            if ($request->hasSession()) {
                Auth::guard('web')->logout();
                $request->session()->invalidate();
            }
            throw new AuthenticationException;
        }
        // Session ouverte en mode support (M01) : elle s'arrête d'elle-même à l'heure prévue.
        $support = $request->hasSession() ? $request->session()->get('support') : null;
        if ($user && $support && now()->greaterThanOrEqualTo($support['until'])) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            throw new AuthenticationException('La session d’assistance est terminée.');
        }

        return $next($request);
    }
}
