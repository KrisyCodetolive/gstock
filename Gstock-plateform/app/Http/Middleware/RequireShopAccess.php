<?php

namespace App\Http\Middleware;

use App\Domain\Shops\Models\Shop;
use App\Support\ApiException;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Ressources de boutique `/shops/{shop}/…` (§6.2, M04) : l'utilisateur doit être
 * affecté à la boutique (le propriétaire les a toutes), et elle doit être ouverte.
 * Vérifié même si l'endpoint est appelé directement.
 */
class RequireShopAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        $shop = $request->route('shop');
        if (! $shop instanceof Shop) {
            $shop = Shop::query()->findOrFail((int) $shop);
            $request->route()->setParameter('shop', $shop);
        }
        $user = $request->user();
        if (! $user->isOwner() && ! $user->shops()->whereKey($shop->id)->exists()) {
            throw ApiException::forbidden("Vous n'avez pas accès à cette boutique.");
        }
        if (! $shop->is_active) {
            throw ApiException::forbidden('Cette boutique est fermée.');
        }

        return $next($request);
    }
}
