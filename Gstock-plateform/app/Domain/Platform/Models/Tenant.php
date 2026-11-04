<?php

namespace App\Domain\Platform\Models;

use App\Domain\Shops\Models\TenantPaymentSetting;
use App\Domain\Shops\Models\TenantSetting;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Stancl\Tenancy\Database\Concerns\HasDomains;
use Stancl\Tenancy\Database\Models\Tenant as BaseTenant;

/**
 * Espace d'un commerçant (§8.1) : identifié par son sous-domaine (`slug`).
 *
 * @property int $id
 * @property string $name
 * @property string $slug
 * @property string $currency_code
 * @property string $timezone
 * @property string $status trial|active|suspended|cancelled
 */
class Tenant extends BaseTenant
{
    use HasDomains;

    protected $casts = [
        'activated_at' => 'datetime',
        'first_sale_at' => 'datetime',
    ];

    /** Colonnes réelles ; le reste irait dans la colonne JSON `data` de stancl. */
    public static function getCustomColumns(): array
    {
        return ['id', 'name', 'slug', 'owner_email', 'phone', 'currency_code', 'timezone', 'status', 'activated_at', 'first_sale_at', 'created_at', 'updated_at'];
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(TenantSubscription::class);
    }

    /** Abonnement en cours (le plus récent). */
    public function subscription(): HasOne
    {
        return $this->hasOne(TenantSubscription::class)->latestOfMany();
    }

    public function settings(): HasOne
    {
        return $this->hasOne(TenantSetting::class);
    }

    public function paymentSettings(): HasOne
    {
        return $this->hasOne(TenantPaymentSetting::class);
    }

    /** Fermé par Genius Groups : plus aucune connexion (M02). */
    public function isClosed(): bool
    {
        return $this->status === 'cancelled';
    }
}
