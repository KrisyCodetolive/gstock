<?php

namespace App\Domain\Shops\Models;

use App\Support\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/**
 * Clés GeniusPay de l'espace (ADR-003) : chiffrées en base, jamais renvoyées en
 * clair (seulement un indice et des booléens).
 */
class TenantPaymentSetting extends Model
{
    use BelongsToTenant;

    protected $fillable = ['provider', 'api_key', 'api_secret', 'webhook_secret', 'is_sandbox', 'is_active'];

    protected $hidden = ['api_key', 'api_secret', 'webhook_secret'];

    protected $casts = [
        'api_key' => 'encrypted',
        'api_secret' => 'encrypted',
        'webhook_secret' => 'encrypted',
        'is_sandbox' => 'boolean',
        'is_active' => 'boolean',
    ];
}
