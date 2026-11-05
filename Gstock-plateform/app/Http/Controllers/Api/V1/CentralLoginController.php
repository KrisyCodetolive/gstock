<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Identity\Models\User;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Platform\Registration\LoginLinks;
use App\Http\Controllers\Controller;
use App\Support\ApiException;
use App\Support\Phone;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * Connexion sur le domaine principal (ADR-009, M02) : le commerçant n'a pas à connaître
 * l'adresse de son espace. Les espaces ne sont révélés qu'avec un mot de passe juste ;
 * chacun est ouvert par un lien de connexion à usage unique vers son sous-domaine.
 */
class CentralLoginController extends Controller
{
    public function login(Request $request, LoginLinks $links): JsonResponse
    {
        $data = $request->validate(
            ['login' => ['required', 'string'], 'password' => ['required', 'string']],
            ['login.required' => 'Saisissez votre e-mail ou votre numéro de téléphone.', 'password.required' => 'Saisissez votre mot de passe.'],
        );
        $login = mb_strtolower(trim($data['login']));

        // Hors espace : la recherche porte sur tous les espaces (aucun filtre d'espace actif ici).
        $users = User::query()
            ->where(fn ($q) => $q->where('email', $login)->orWhere('phone', Phone::normalize($login)))
            ->get()
            ->filter(fn (User $u) => Hash::check($data['password'], $u->password));
        if ($users->isEmpty()) {
            throw new ApiException(422, 'Identifiants incorrects.', ['login' => ['E-mail, téléphone ou mot de passe incorrect.']]);
        }

        $tenants = Tenant::query()->whereKey($users->pluck('tenant_id'))->get()->keyBy('id');
        $open = $users->filter(fn (User $u) => ($tenant = $tenants->get($u->tenant_id)) && ! $tenant->isClosed());
        if ($open->isEmpty()) {
            throw ApiException::invalid('login', 'Cet espace est fermé. Contactez le support GStock.');
        }
        $active = $open->filter(fn (User $u) => $u->is_active);
        if ($active->isEmpty()) {
            throw ApiException::invalid('login', 'Ce compte est désactivé. Demandez au propriétaire de la boutique de le réactiver.');
        }

        return response()->json(['data' => ['spaces' => $active->map(function (User $u) use ($tenants, $links) {
            $tenant = $tenants->get($u->tenant_id);
            $url = str_replace('{tenant}', $tenant->slug, config('gstock.frontend_url'));

            return [
                'name' => $tenant->name,
                'slug' => $tenant->slug,
                'url' => $url,
                'login_url' => $url.'/connexion/lien?jeton='.$links->issue($tenant->id, $u->id),
            ];
        })->sortBy('name')->values()]]);
    }
}
