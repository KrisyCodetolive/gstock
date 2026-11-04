<?php

namespace App\Domain\Sales\Models;

use App\Support\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/** Mode de paiement (M05, §8.5) ; GeniusPay seulement pour le Mobile Money et la carte (ADR-003). */
class PaymentMethod extends Model
{
    use BelongsToTenant;

    public const TYPES = ['cash', 'mobile_money', 'card', 'other'];

    protected $fillable = ['name', 'type', 'uses_geniuspay', 'is_active'];

    protected $casts = ['uses_geniuspay' => 'boolean', 'is_active' => 'boolean'];
}
