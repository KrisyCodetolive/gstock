<?php

namespace App\Domain\Platform\Registration;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Lien de connexion à usage unique, envoyé à la fin de l'inscription (M00) :
 * il ouvre le sous-domaine du nouvel espace déjà connecté. Valable quelques
 * minutes, lié à l'espace, détruit à la première utilisation.
 */
final class LoginLinks
{
    public function issue(int $tenantId, int $userId): string
    {
        $token = Str::random(48);
        Cache::put($this->key($token), ['tenant_id' => $tenantId, 'user_id' => $userId], now()->addMinutes(config('gstock.login_link_ttl')));

        return $token;
    }

    /** Identifiant de l'utilisateur si le jeton est valable pour cet espace ; le jeton est consommé. */
    public function consume(string $token, int $tenantId): ?int
    {
        if ($token === '') {
            return null;
        }
        // Présenté à un autre espace, le lien reste valable pour le sien.
        $entry = Cache::get($this->key($token));
        if (! $entry || $entry['tenant_id'] !== $tenantId) {
            return null;
        }
        // `add` n'écrit que si la clé est absente, de façon atomique : de deux utilisations simultanées, une seule réussit.
        if (! Cache::add($this->key($token).':used', true, now()->addMinutes(config('gstock.login_link_ttl')))) {
            return null;
        }
        Cache::forget($this->key($token));

        return $entry['user_id'];
    }

    private function key(string $token): string
    {
        // Seule l'empreinte du jeton est gardée.
        return 'login-link:'.hash('sha256', $token);
    }
}
