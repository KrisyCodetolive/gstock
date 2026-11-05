<?php

namespace App\Domain\Shops\Models;

use App\Support\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/** Paramètres de l'espace (§8.2). Le nom et le fuseau sont sur l'espace lui-même. */
class TenantSetting extends Model
{
    use BelongsToTenant;

    protected $fillable = ['phone', 'email', 'address', 'receipt_footer', 'advanced_mode', 'default_payment_method_id', 'logo_path', 'expiry_alert_days'];

    protected $casts = ['advanced_mode' => 'boolean', 'expiry_alert_days' => 'integer'];
}
