<?php

namespace App\Domain\Identity;

use App\Domain\Identity\Mail\ResetPasswordLink;
use App\Domain\Identity\Models\User;
use App\Domain\Platform\CurrentTenant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

/**
 * Liens de réinitialisation (M02) : jeton aléatoire envoyé par e-mail, gardé
 * haché, valable 60 minutes, utilisable une fois. Un nouveau lien remplace l'ancien.
 */
final class PasswordResets
{
    public function send(User $user): void
    {
        $token = Str::random(64);
        DB::table('password_reset_tokens')->updateOrInsert(
            ['user_id' => $user->id],
            [
                'tenant_id' => $user->tenant_id,
                'token_hash' => hash('sha256', $token),
                'expires_at' => now()->addMinutes(config('gstock.password_reset_ttl')),
                'created_at' => now(),
                'updated_at' => now(),
            ],
        );

        $url = str_replace('{tenant}', CurrentTenant::get()->slug, config('gstock.frontend_url'))
            .'/reinitialiser-mot-de-passe?jeton='.$token;
        Mail::to($user->email)->queue(new ResetPasswordLink($user, $url));
    }

    /** L'utilisateur du jeton s'il est valable ; le jeton est alors détruit. */
    public function consume(string $token): ?User
    {
        $row = DB::table('password_reset_tokens')
            ->where('tenant_id', CurrentTenant::get()->id)
            ->where('token_hash', hash('sha256', $token))
            ->first();
        if (! $row) {
            return null;
        }
        DB::table('password_reset_tokens')->where('id', $row->id)->delete();
        if (now()->greaterThan($row->expires_at)) {
            return null;
        }
        $user = User::query()->find($row->user_id);

        return $user?->is_active ? $user : null;
    }
}
