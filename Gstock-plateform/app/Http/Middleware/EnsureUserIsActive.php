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

        return $next($request);
    }
}
