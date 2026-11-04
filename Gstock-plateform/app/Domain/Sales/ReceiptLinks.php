<?php

namespace App\Domain\Sales;

use App\Domain\Platform\CurrentTenant;
use Carbon\CarbonImmutable;

/**
 * Liens de reçu signés et expirants (ADR-013) : jeton opaque, signé avec la clé
 * de l'application (HMAC), valable 7 jours, lié à l'espace. `s` : vente, `r` : paiement de crédit.
 */
final class ReceiptLinks
{
    public const DAYS = 7;

    /** @return array{token: string, expires_at: CarbonImmutable} */
    public function sign(string $kind, int $shopId, int $id): array
    {
        $exp = CarbonImmutable::now()->addDays(self::DAYS);
        $payload = implode('.', [$kind, CurrentTenant::get()->id, $shopId, $id, $exp->getTimestamp()]);

        return ['token' => self::b64($payload).'.'.self::b64(hash_hmac('sha256', $payload, $this->key(), true)), 'expires_at' => $exp];
    }

    /** @return array{kind: string, shop_id: int, id: int, expired: bool}|null null si le jeton est faux ou d'un autre espace */
    public function read(string $token): ?array
    {
        [$p, $sig] = array_pad(explode('.', $token, 2), 2, '');
        $payload = self::unb64($p);
        if ($payload === null || ! hash_equals(hash_hmac('sha256', $payload, $this->key(), true), self::unb64($sig) ?? '')) {
            return null;
        }
        [$kind, $tenantId, $shopId, $id, $exp] = array_pad(explode('.', $payload), 5, null);
        if (! in_array($kind, ['s', 'r'], true) || (int) $tenantId !== CurrentTenant::get()->id) {
            return null;
        }

        return ['kind' => $kind, 'shop_id' => (int) $shopId, 'id' => (int) $id, 'expired' => (int) $exp < now()->getTimestamp()];
    }

    private function key(): string
    {
        return 'receipt-links|'.config('app.key');
    }

    private static function b64(string $s): string
    {
        return rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
    }

    private static function unb64(string $s): ?string
    {
        $decoded = base64_decode(strtr($s, '-_', '+/'), true);

        return $decoded === false ? null : $decoded;
    }
}
