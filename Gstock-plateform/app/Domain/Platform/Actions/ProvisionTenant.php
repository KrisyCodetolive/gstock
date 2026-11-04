<?php

namespace App\Domain\Platform\Actions;

use App\Domain\Identity\Models\Role;
use App\Domain\Identity\Models\User;
use App\Domain\Platform\Models\Plan;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Shops\Models\Shop;
use App\Domain\Shops\Models\TenantPaymentSetting;
use App\Domain\Shops\Models\TenantSetting;
use Illuminate\Support\Facades\DB;

/**
 * Provisionnement d'un espace (M00) : l'espace et son sous-domaine, l'abonnement
 * d'essai, les paramètres, le rôle Owner et le propriétaire, la première boutique.
 * Les référentiels par défaut (unités, modes de paiement, catégories de dépenses)
 * seront ajoutés avec leurs modules.
 */
final class ProvisionTenant
{
    /**
     * @param  array{name: string, slug: string, phone?: ?string, plan: Plan, shop: array{name: string, city: string}, owner: array{firstname: string, lastname: string, email?: ?string, phone?: ?string, password: string}}  $data
     * @return array{tenant: Tenant, owner: User, shop: Shop}
     */
    public function handle(array $data): array
    {
        return DB::transaction(function () use ($data) {
            $plan = $data['plan'];
            $tenant = Tenant::create([
                'name' => $data['name'],
                'slug' => $data['slug'],
                'owner_email' => $data['owner']['email'] ?? null,
                'phone' => $data['phone'] ?? $data['owner']['phone'] ?? null,
                'currency_code' => config('gstock.currency'),
                'timezone' => config('gstock.timezone'),
                'status' => 'trial',
            ]);
            $tenant->domains()->create(['domain' => $data['slug']]);
            $tenant->subscriptions()->create([
                'plan_id' => $plan->id,
                'starts_at' => now(),
                'trial_ends_at' => now()->addDays($plan->trial_days),
                'status' => 'trial',
            ]);

            $result = $tenant->run(function () use ($data) {
                TenantSetting::create(['phone' => $data['phone'] ?? null, 'email' => $data['owner']['email'] ?? null]);
                TenantPaymentSetting::create(['provider' => 'geniuspay']);

                $ownerRole = Role::create(['name' => 'Owner', 'description' => "Créateur de l'espace : toutes les permissions.", 'is_owner' => true]);
                $owner = User::create([...$data['owner'], 'role_id' => $ownerRole->id, 'is_active' => true]);
                $shop = Shop::create($data['shop']);

                return ['owner' => $owner, 'shop' => $shop];
            });

            return ['tenant' => $tenant, ...$result];
        });
    }
}
