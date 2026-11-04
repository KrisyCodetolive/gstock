<?php

namespace App\Http\Resources;

use App\Domain\Audit\Models\AuditLog;
use App\Domain\Identity\Models\Role;
use App\Domain\Identity\Models\User;
use App\Domain\Platform\CurrentTenant;
use App\Domain\Shops\Models\Shop;
use App\Domain\Shops\Models\TenantPaymentSetting;

/**
 * Forme JSON des ressources du socle, identique au contrat du frontend
 * (`Gstock-frontend/src/types/`). Dates en ISO 8601, montants en chaînes.
 */
final class Present
{
    /** GET /me : tout ce qu'il faut au chargement (menu, sélecteur de boutique). */
    public static function me(User $user): array
    {
        $tenant = CurrentTenant::get();
        $settings = $tenant->settings;

        return [
            'user' => self::userSummary($user),
            'role' => self::roleSummary($user->role),
            'permissions' => $user->permissionNames(),
            'shops' => $user->accessibleShops()->map(self::shopSummary(...))->values()->all(),
            'tenant' => [
                'name' => $tenant->name,
                'currency' => $tenant->currency_code,
                'timezone' => $tenant->timezone,
                'advanced_mode' => (bool) $settings?->advanced_mode,
                'subscription' => CurrentTenant::state()->summary(),
            ],
            // Session ouverte par l'assistance GStock (M01) : l'application affiche un bandeau.
            'support' => self::supportSession(),
        ];
    }

    /** @return ?array{admin_name: string, expires_at: string} */
    private static function supportSession(): ?array
    {
        $support = request()->hasSession() ? request()->session()->get('support') : null;

        return $support ? ['admin_name' => $support['admin'], 'expires_at' => $support['until']] : null;
    }

    public static function userSummary(User $user): array
    {
        return [
            'id' => $user->id,
            'firstname' => $user->firstname,
            'lastname' => $user->lastname,
            'email' => $user->email,
            'phone' => $user->phone,
            'avatar_url' => $user->avatarUrl(),
        ];
    }

    /** Ressource /users : le propriétaire a accès à toutes les boutiques (§6.2). */
    public static function user(User $user): array
    {
        $shops = $user->isOwner() ? Shop::query()->orderBy('id')->get() : $user->shops->sortBy('id');

        return [
            ...self::userSummary($user),
            'role' => self::roleSummary($user->role),
            'shops' => $shops->map(self::shopSummary(...))->values()->all(),
            'is_active' => $user->is_active,
            'last_login_at' => $user->last_login_at?->toIso8601String(),
        ];
    }

    public static function roleSummary(Role $role): array
    {
        return ['id' => $role->id, 'name' => $role->name, 'is_owner' => $role->is_owner];
    }

    public static function role(Role $role): array
    {
        return [
            ...self::roleSummary($role),
            'description' => $role->description,
            'permissions' => $role->permissionNames(),
            'users_count' => (int) ($role->users_count ?? $role->users()->count()),
        ];
    }

    public static function shopSummary(Shop $shop): array
    {
        return ['id' => $shop->id, 'name' => $shop->name, 'city' => $shop->city, 'district' => $shop->district];
    }

    /** Ressource /shops : `users_count` compte les propriétaires et les affectés. */
    public static function shop(Shop $shop): array
    {
        $owners = User::query()->whereHas('role', fn ($q) => $q->where('is_owner', true))->count();
        $assigned = $shop->users()->whereHas('role', fn ($q) => $q->where('is_owner', false))->count();

        return [
            'id' => $shop->id,
            ...$shop->only(['name', 'city', 'district', 'address', 'phone', 'receipt_note', 'receipt_show_customer', 'receipt_show_phone', 'auto_print_receipt', 'default_customer_id', 'is_active']),
            'users_count' => $owners + $assigned,
        ];
    }

    /** GET|PUT /settings */
    public static function settings(): array
    {
        $tenant = CurrentTenant::get();
        $settings = $tenant->settings;
        $plan = CurrentTenant::plan();

        return [
            'name' => $tenant->name,
            'logo_url' => null,
            'phone' => $settings?->phone,
            'email' => $settings?->email,
            'address' => $settings?->address,
            'currency' => $tenant->currency_code,
            'timezone' => $tenant->timezone,
            'receipt_footer' => $settings?->receipt_footer,
            'advanced_mode' => (bool) $settings?->advanced_mode,
            'plan' => ['name' => $plan->name, 'max_shops' => $plan->max_shops, 'max_users' => $plan->max_users, 'max_products' => $plan->max_products],
        ];
    }

    /** GET|PUT /settings/payment : un indice de la clé, jamais la clé elle-même. */
    public static function paymentSettings(TenantPaymentSetting $s): array
    {
        return [
            'provider' => $s->provider,
            'api_key_hint' => $s->api_key ? '•••• '.substr($s->api_key, -4) : null,
            'has_api_secret' => (bool) $s->api_secret,
            'has_webhook_secret' => (bool) $s->webhook_secret,
            'is_sandbox' => $s->is_sandbox,
            'is_active' => $s->is_active,
            // Null tant que le commerçant n'a rien enregistré (ligne créée à l'inscription).
            'updated_at' => $s->updated_at && $s->updated_at->gt($s->created_at) ? $s->updated_at->toIso8601String() : null,
        ];
    }

    public static function auditLog(AuditLog $log): array
    {
        return [
            'id' => $log->id,
            'action' => $log->action,
            'shop' => $log->shop ? ['id' => $log->shop->id, 'name' => $log->shop->name] : null,
            'user' => $log->user ? ['id' => $log->user->id, 'name' => $log->user->name()] : null,
            'subject' => $log->subject_type ? ['type' => $log->subject_type, 'id' => $log->subject_id, 'label' => $log->subject_label] : null,
            'reason' => $log->reason,
            'old_values' => $log->old_values,
            'new_values' => $log->new_values,
            'created_at' => $log->created_at->toIso8601String(),
        ];
    }
}
