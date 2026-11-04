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
    /** @param  array{support?: array{admin: string, until: string}}  $extra  mode support du back-office (M01) */
    public function issue(int $tenantId, int $userId, array $extra = []): string
    {
        $token = Str::random(48);
        Cache::put($this->key($token), ['tenant_id' => $tenantId, 'user_id' => $userId, ...$extra], now()->addMinutes(config('gstock.login_link_ttl')));

        return $token;
    }

    /**
     * Contenu du lien s'il est valable pour cet espace ; le lien est consommé.
     *
     * @return ?array{tenant_id: int, user_id: int, support?: array{admin: string, until: string}}
     */
    public function consume(string $token, int $tenantId): ?array
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

        return $entry;
    }

    private function key(string $token): string
    {
        // Seule l'empreinte du jeton est gardée.
        return 'login-link:'.hash('sha256', $token);
    }
}
