<?php

namespace App\Domain\Platform;

use App\Domain\Platform\Models\TenantSubscription;
use Carbon\CarbonImmutable;

/**
 * État d'un abonnement, recalculé à partir des dates (M00) : essai, payé, impayé
 * (délai de grâce), puis suspendu en lecture seule. Un espace fermé par
 * Genius Groups est « cancelled ».
 */
final class SubscriptionState
{
    private function __construct(
        /** trial | active | past_due | cancelled */
        public readonly string $status,
        /** trial | active | suspended | cancelled */
        public readonly string $tenantStatus,
        public readonly bool $readOnly,
        public readonly int $daysLeft,
        public readonly ?CarbonImmutable $graceEndsAt,
    ) {}

    public static function of(TenantSubscription $subscription, ?CarbonImmutable $now = null): self
    {
        $now ??= CarbonImmutable::now();
        if ($subscription->tenant?->isClosed()) {
            return new self('cancelled', 'cancelled', true, 0, null);
        }
        $state = self::fromDates($subscription, $now);
        // Suspendu par Genius Groups (M01) : lecture seule, l'abonnement garde son état.
        if ($subscription->tenant?->isSuspendedByPlatform()) {
            return new self($state->status, 'suspended', true, $state->daysLeft, $state->graceEndsAt);
        }

        return $state;
    }

    private static function fromDates(TenantSubscription $subscription, CarbonImmutable $now): self
    {

        $paidUntil = $subscription->ends_at?->toImmutable();
        $trialUntil = $subscription->trial_ends_at?->toImmutable();
        $end = collect([$paidUntil, $trialUntil])->filter()->max() ?? $now;
        $graceEnd = $end->addDays(config('gstock.grace_days'));

        if ($paidUntil && $paidUntil->greaterThan($now)) {
            return new self('active', 'active', false, self::daysUntil($paidUntil, $now), null);
        }
        if ($trialUntil && $trialUntil->greaterThan($now)) {
            return new self('trial', 'trial', false, self::daysUntil($trialUntil, $now), null);
        }
        $suspended = ! $now->lessThan($graceEnd);
        $tenantStatus = $suspended ? 'suspended' : ($paidUntil ? 'active' : 'trial');

        return new self('past_due', $tenantStatus, $suspended, self::daysUntil($graceEnd, $now), $graceEnd);
    }

    private static function daysUntil(CarbonImmutable $until, CarbonImmutable $now): int
    {
        return max(0, (int) ceil(($until->getTimestamp() - $now->getTimestamp()) / 86400));
    }

    /** Résumé renvoyé dans GET /me (`tenant.subscription`). */
    public function summary(): array
    {
        return [
            'status' => $this->status,
            'tenant_status' => $this->tenantStatus,
            'read_only' => $this->readOnly,
            'days_left' => $this->daysLeft,
        ];
    }
}
