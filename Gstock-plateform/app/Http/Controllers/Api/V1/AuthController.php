<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Audit\Audit;
use App\Domain\Identity\Models\User;
use App\Domain\Identity\PasswordResets;
use App\Domain\Platform\CurrentTenant;
use App\Domain\Platform\Registration\LoginLinks;
use App\Http\Controllers\Controller;
use App\Http\Resources\Present;
use App\Support\ApiException;
use App\Support\Phone;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/** Connexion, déconnexion, mot de passe oublié (M02). Session Sanctum par cookie (ADR-008). */
class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate(
            ['login' => ['required', 'string'], 'password' => ['required', 'string']],
            ['login.required' => 'Saisissez votre e-mail ou votre numéro de téléphone.', 'password.required' => 'Saisissez votre mot de passe.'],
        );

        $login = mb_strtolower(trim($data['login']));
        $user = User::query()
            ->where(fn ($q) => $q->where('email', $login)->orWhere('phone', Phone::normalize($login)))
            ->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw new ApiException(422, 'Identifiants incorrects.', ['login' => ['E-mail, téléphone ou mot de passe incorrect.']]);
        }
        // Espace fermé par Genius Groups : plus de connexion. Un espace suspendu reste consultable.
        if (CurrentTenant::get()->isClosed()) {
            throw ApiException::invalid('login', 'Cet espace est fermé. Contactez le support GStock.');
        }
        if (! $user->is_active) {
            throw ApiException::invalid('login', 'Ce compte est désactivé. Demandez au propriétaire de la boutique de le réactiver.');
        }

        Auth::guard('web')->login($user);
        $request->session()->regenerate();
        $user->forceFill(['last_login_at' => now()])->save();

        return response()->json(['data' => Present::me($user)]);
    }

    /** Lien de connexion à usage unique reçu à l'inscription (M00) : ouvre l'espace déjà connecté. */
    public function tokenLogin(Request $request, LoginLinks $links): JsonResponse
    {
        $tenant = CurrentTenant::get();
        $userId = $links->consume((string) $request->input('token', ''), $tenant->id);
        $user = $userId ? User::query()->find($userId) : null;
        if (! $user || ! $user->is_active || $tenant->isClosed()) {
            throw new ApiException(422, 'Ce lien de connexion a expiré ou a déjà servi. Connectez-vous avec votre e-mail et votre mot de passe.');
        }

        Auth::guard('web')->login($user);
        $request->session()->regenerate();
        $user->forceFill(['last_login_at' => now()])->save();

        return response()->json(['data' => Present::me($user)]);
    }

    public function logout(Request $request): Response
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->noContent();
    }

    /** Même réponse que le compte existe ou non : pas d'énumération des comptes. */
    public function forgotPassword(Request $request, PasswordResets $resets): JsonResponse
    {
        $data = $request->validate(
            ['email' => ['required', 'email']],
            ['email.required' => 'Saisissez votre adresse e-mail.', 'email.email' => "Cette adresse e-mail n'est pas valide."],
        );

        $user = User::query()->where('email', mb_strtolower(trim($data['email'])))->where('is_active', true)->first();
        if ($user) {
            $resets->send($user);
        }

        return response()->json(['data' => [
            'message' => "Si un compte utilise cette adresse, un lien pour choisir un nouveau mot de passe vient d'y être envoyé. Il est valable 60 minutes.",
        ]]);
    }

    public function resetPassword(Request $request, PasswordResets $resets): Response
    {
        $data = $request->validate(
            ['token' => ['required', 'string'], 'password' => ['required', 'string', 'min:8', 'confirmed']],
            [
                'token.required' => 'Ce lien a expiré ou a déjà servi. Demandez-en un nouveau.',
                'password.required' => 'Le mot de passe doit contenir au moins 8 caractères.',
                'password.min' => 'Le mot de passe doit contenir au moins 8 caractères.',
                'password.confirmed' => 'Les deux mots de passe ne sont pas identiques.',
            ],
        );

        $user = $resets->consume($data['token']);
        if (! $user) {
            throw new ApiException(422, 'Ce lien a expiré ou a déjà servi. Demandez-en un nouveau.');
        }

        DB::transaction(function () use ($user, $data) {
            $user->forceFill(['password' => $data['password'], 'remember_token' => null])->save();
            // Les sessions et jetons ouverts avec l'ancien mot de passe sont fermés.
            DB::table('sessions')->where('user_id', $user->id)->delete();
            $user->tokens()->delete();
            Audit::record($user, 'user.password_reset', ['subject' => $user, 'label' => $user->name()]);
        });

        return response()->noContent();
    }
}
