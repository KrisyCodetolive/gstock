<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Audit\Audit;
use App\Domain\Identity\Models\User;
use App\Http\Controllers\Controller;
use App\Http\Resources\Present;
use App\Support\ApiException;
use App\Support\Phone;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/** La personne connectée : son compte, son profil, sa photo, son mot de passe (M02). */
class MeController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return response()->json(['data' => Present::me($request->user())]);
    }

    /** Le rôle et les boutiques restent gérés par le propriétaire (M04). */
    public function update(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $request->merge([
            'email' => ($e = trim((string) $request->input('email'))) === '' ? null : mb_strtolower($e),
            'phone' => Phone::normalize($request->input('phone')),
        ]);
        $data = $request->validate([
            'firstname' => ['required', 'string', 'max:100'],
            'lastname' => ['required', 'string', 'max:100'],
            'email' => ['nullable', 'email', 'required_without:phone', Rule::unique('users')->where('tenant_id', $user->tenant_id)->ignore($user->id)],
            'phone' => ['nullable', 'regex:/^\d{8,12}$/', Rule::unique('users')->where('tenant_id', $user->tenant_id)->ignore($user->id)],
        ], [
            'firstname.required' => 'Saisissez votre prénom.',
            'lastname.required' => 'Saisissez votre nom.',
            'email.required_without' => 'Gardez un e-mail ou un numéro de téléphone pour vous connecter.',
            'email.email' => "Cette adresse e-mail n'est pas valide.",
            'email.unique' => 'Cet e-mail est déjà utilisé par un autre utilisateur.',
            'phone.regex' => "Ce numéro de téléphone n'est pas valide.",
            'phone.unique' => 'Ce numéro est déjà utilisé par un autre utilisateur.',
        ]);

        $user->update([...$data, 'firstname' => trim($data['firstname']), 'lastname' => trim($data['lastname'])]);

        return response()->json(['data' => Present::me($user)]);
    }

    public function password(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:6', 'confirmed'],
        ], [
            'current_password.required' => 'Saisissez votre mot de passe actuel.',
            'password.required' => 'Le mot de passe doit contenir au moins 6 caractères.',
            'password.min' => 'Le mot de passe doit contenir au moins 6 caractères.',
            'password.confirmed' => 'Les deux mots de passe ne sont pas identiques.',
        ]);
        if (! Hash::check($data['current_password'], $user->password)) {
            throw ApiException::invalid('current_password', 'Le mot de passe actuel est incorrect.');
        }
        if (Hash::check($data['password'], $user->password)) {
            throw ApiException::invalid('password', "Choisissez un mot de passe différent de l'actuel.");
        }

        $user->update(['password' => $data['password']]);
        Audit::record($user, 'user.password_changed', ['subject' => $user, 'label' => $user->name()]);

        return response()->noContent();
    }

    /** Photo déjà réduite par l'application ; rangée hors de la racine web publique de l'API. */
    public function uploadAvatar(Request $request): JsonResponse
    {
        $request->validate(
            ['avatar' => ['required', 'file', 'mimetypes:image/jpeg,image/png,image/webp', 'max:1024']],
            [
                'avatar.required' => 'Choisissez une photo au format JPEG, PNG ou WebP.',
                'avatar.mimetypes' => 'Choisissez une photo au format JPEG, PNG ou WebP.',
                'avatar.max' => 'Cette photo est trop lourde.',
            ],
        );
        /** @var User $user */
        $user = $request->user();
        $old = $user->avatar_path;
        $path = $request->file('avatar')->store("tenants/{$user->tenant_id}/avatars", 'public');
        $user->forceFill(['avatar_path' => $path])->save();
        if ($old) {
            Storage::disk('public')->delete($old);
        }

        return response()->json(['data' => Present::me($user)]);
    }

    public function deleteAvatar(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if ($user->avatar_path) {
            Storage::disk('public')->delete($user->avatar_path);
            $user->forceFill(['avatar_path' => null])->save();
        }

        return response()->json(['data' => Present::me($user)]);
    }
}
