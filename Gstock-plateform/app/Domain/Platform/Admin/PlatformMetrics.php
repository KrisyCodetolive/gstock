<?php

namespace App\Domain\Platform\Admin;

use App\Domain\Platform\Models\Tenant;
use App\Domain\Platform\SubscriptionState;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Indicateurs du back-office (M01), lus directement dans les tables : ils
 * correspondent toujours aux données réelles des espaces.
 */
final class PlatformMetrics
{
    /** État lisible d'un espace, pour les listes et les fiches. */
    public const STATES = [
        'trial' => 'Essai',
        'active' => 'Payé',
        'past_due' => 'Impayé (délai de grâce)',
        'suspended' => 'Suspendu',
        'cancelled' => 'Fermé',
    ];

    public static function stateOf(Tenant $tenant): string
    {
        $subscription = $tenant->subscription;
        if (! $subscription) {
            return 'cancelled';
        }
        $s = SubscriptionState::of($subscription);
        if ($s->tenantStatus === 'cancelled' || $s->tenantStatus === 'suspended') {
            return $s->tenantStatus;
        }

        return $s->status;
    }

    public static function stateColor(string $state): string
    {
        return ['trial' => 'info', 'active' => 'success', 'past_due' => 'warning', 'suspended' => 'danger', 'cancelled' => 'gray'][$state] ?? 'gray';
    }

    /** Filtre SQL équivalent à l'état calculé (essai, payé, impayé, suspendu, fermé). */
    public static function whereState(Builder $query, string $state): Builder
    {
        $now = now();
        $grace = (int) config('gstock.grace_days');
        $paid = fn ($q) => $q->where('ends_at', '>', $now);
        $trial = fn ($q) => $q->where('trial_ends_at', '>', $now)->where(fn ($w) => $w->whereNull('ends_at')->orWhere('ends_at', '<=', $now));
        // Fin de l'essai ou de la période payée (la plus tardive), plus le délai de grâce.
        $graceEnd = "greatest(coalesce(ends_at, trial_ends_at), coalesce(trial_ends_at, ends_at)) + interval '{$grace} days'";

        return match ($state) {
            'cancelled' => $query->where('status', 'cancelled'),
            'suspended' => $query->where('status', '!=', 'cancelled')->where(fn ($q) => $q->whereNotNull('suspended_at')
                ->orWhereHas('subscription', fn ($s) => $s->where(fn ($w) => $w->whereNull('ends_at')->orWhere('ends_at', '<=', $now))
                    ->where(fn ($w) => $w->whereNull('trial_ends_at')->orWhere('trial_ends_at', '<=', $now))->whereRaw("{$graceEnd} <= ?", [$now]))),
            'active' => $query->where('status', '!=', 'cancelled')->whereNull('suspended_at')->whereHas('subscription', $paid),
            'trial' => $query->where('status', '!=', 'cancelled')->whereNull('suspended_at')->whereHas('subscription', $trial),
            'past_due' => $query->where('status', '!=', 'cancelled')->whereNull('suspended_at')->whereHas('subscription', fn ($s) => $s
                ->where(fn ($w) => $w->whereNull('ends_at')->orWhere('ends_at', '<=', $now))
                ->where(fn ($w) => $w->whereNull('trial_ends_at')->orWhere('trial_ends_at', '<=', $now))
                ->whereRaw("{$graceEnd} > ?", [$now])),
            default => $query,
        };
    }

    /** Indicateurs d'usage d'un espace, pour sa fiche. */
    public static function usage(Tenant $tenant): array
    {
        $t = fn (string $table) => DB::table($table)->where('tenant_id', $tenant->id);
        $sales = $t('sales')->where('status', 'completed');

        return [
            'shops' => $t('shops')->where('is_active', true)->count(),
            'users' => $t('users')->count(),
            'active_users_30' => $t('users')->where('last_login_at', '>=', now()->subDays(30))->count(),
            'products' => $t('products')->where('is_active', true)->count(),
            'customers' => $t('customers')->count(),
            'sales' => (clone $sales)->count(),
            'sales_30' => (clone $sales)->where('occurred_at', '>=', now()->subDays(30))->count(),
            'sales_amount_30' => (string) ((clone $sales)->where('occurred_at', '>=', now()->subDays(30))->sum('total') ?: '0'),
            'last_sale_at' => (clone $sales)->max('occurred_at'),
            // Lus dans les données (les colonnes de l'espace ne sont tenues qu'à l'ouverture de l'assistant).
            'activated_at' => $tenant->activated_at?->toDateTimeString() ?? $t('products')->min('created_at'),
            'first_sale_at' => $t('sales')->min('occurred_at'),
            'credits_remaining' => (string) ($t('customer_credits')->where('status', '!=', 'cancelled')->sum('remaining_amount') ?: '0'),
            'last_activity_at' => self::lastActivity($tenant->id),
        ];
    }

    /** Dernière activité : dernière connexion d'un utilisateur ou dernière vente. */
    public static function lastActivity(int $tenantId): ?string
    {
        $values = array_filter([
            DB::table('users')->where('tenant_id', $tenantId)->max('last_login_at'),
            DB::table('sales')->where('tenant_id', $tenantId)->max('occurred_at'),
        ]);

        return $values ? max($values) : null;
    }

    /** Tableau de bord de la plateforme (M01). */
    public static function overview(): array
    {
        $now = CarbonImmutable::now();
        $tenants = DB::table('tenants')->count();
        // Conversion : parmi les espaces dont l'essai est terminé, part de ceux qui ont payé au moins une fois.
        $trialOver = DB::table('tenant_subscriptions')->where('trial_ends_at', '<=', $now)->distinct()->count('tenant_id');
        $paying = DB::table('tenant_invoices')->where('status', 'paid')->distinct()->count('tenant_id');
        $convertedAfterTrial = DB::table('tenant_subscriptions')->where('trial_ends_at', '<=', $now)
            ->whereIn('tenant_id', DB::table('tenant_invoices')->where('status', 'paid')->select('tenant_id'))->distinct()->count('tenant_id');
        // Churn : parmi les espaces qui ont payé, part de ceux dont la période payée est finie depuis plus que le délai de grâce.
        $lapsed = DB::table('tenant_subscriptions')->whereIn('tenant_id', DB::table('tenant_invoices')->where('status', 'paid')->select('tenant_id'))
            ->where('ends_at', '<', $now->subDays((int) config('gstock.grace_days')))->distinct()->count('tenant_id');

        return [
            'tenants' => $tenants,
            'tenants_30' => DB::table('tenants')->where('created_at', '>=', $now->subDays(30))->count(),
            'activated' => DB::table('products')->distinct()->count('tenant_id'),
            'first_sale' => DB::table('sales')->where('status', 'completed')->distinct()->count('tenant_id'),
            'active_users_7' => DB::table('users')->where('last_login_at', '>=', $now->subDays(7))->count(),
            'active_users_30' => DB::table('users')->where('last_login_at', '>=', $now->subDays(30))->count(),
            'sales_30' => DB::table('sales')->where('status', 'completed')->where('occurred_at', '>=', $now->subDays(30))->count(),
            'credits' => DB::table('customer_credits')->where('status', '!=', 'cancelled')->count(),
            'repayments' => DB::table('credit_repayments')->where('status', 'completed')->count(),
            'paying' => $paying,
            'conversion' => $trialOver > 0 ? (int) round($convertedAfterTrial / $trialOver * 100) : null,
            'churn' => $paying > 0 ? (int) round($lapsed / $paying * 100) : null,
            'revenue_month' => (string) (DB::table('tenant_invoices')->where('status', 'paid')
                ->whereBetween('paid_at', [$now->startOfMonth(), $now->endOfMonth()])->sum('amount') ?: '0'),
        ];
    }

    public static function fcfa(string|float|int|null $amount): string
    {
        return number_format((float) $amount, 0, ',', "\u{202F}").' FCFA';
    }
}
