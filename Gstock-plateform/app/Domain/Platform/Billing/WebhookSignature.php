<?php

namespace App\Domain\Platform\Billing;

/** Signature des webhooks GeniusPay : HMAC SHA-256 du corps brut avec le secret du webhook. */
final class WebhookSignature
{
    public const HEADER = 'X-GeniusPay-Signature';

    public static function sign(string $body, string $secret): string
    {
        return hash_hmac('sha256', $body, $secret);
    }

    public static function valid(string $body, ?string $signature, ?string $secret): bool
    {
        return filled($secret) && filled($signature) && hash_equals(self::sign($body, $secret), (string) $signature);
    }
}
