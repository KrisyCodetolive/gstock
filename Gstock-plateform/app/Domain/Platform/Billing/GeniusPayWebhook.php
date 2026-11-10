<?php

namespace App\Domain\Platform\Billing;

/**
 * Webhook GeniusPay (https://pay.genius.ci/docs/api#webhooks) : en-têtes
 * `X-Webhook-Signature` = HMAC-SHA256(« timestamp.corps », secret whsec_…) et
 * `X-Webhook-Timestamp`, refusé au-delà de 5 minutes (rejeu).
 */
final class GeniusPayWebhook
{
    public const SIGNATURE = 'X-Webhook-Signature';

    public const TIMESTAMP = 'X-Webhook-Timestamp';

    public const TOLERANCE = 300;

    public static function sign(string $body, int|string $timestamp, string $secret): string
    {
        return hash_hmac('sha256', $timestamp.'.'.$body, $secret);
    }

    public static function valid(string $body, ?string $signature, ?string $timestamp, ?string $secret, ?int $now = null): bool
    {
        if (blank($secret) || blank($signature) || ! is_numeric($timestamp) || abs(($now ?? time()) - (int) $timestamp) > self::TOLERANCE) {
            return false;
        }
        // GeniusPay signe le JSON tel qu'il l'encode (json_encode PHP) : on accepte le corps brut
        // ou sa réécriture, pour ne pas dépendre d'un détail d'espaces ou d'échappement.
        $candidates = [$body];
        $decoded = json_decode($body, true);
        if (is_array($decoded)) {
            $candidates[] = json_encode($decoded);
            $candidates[] = json_encode($decoded, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        }
        foreach (array_unique($candidates) as $candidate) {
            if (hash_equals(self::sign($candidate, $timestamp, $secret), (string) $signature)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Issue portée par un événement : payé, échoué, ou null pour les événements sans
     * conséquence (payment.initiated, webhook.test, retraits…).
     */
    public static function outcome(string $event): ?string
    {
        return match ($event) {
            'payment.success' => GatewayPayment::PAID,
            'payment.failed', 'payment.cancelled', 'payment.expired' => GatewayPayment::FAILED,
            default => null,
        };
    }
}
