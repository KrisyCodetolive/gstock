<?php

namespace App\Domain\Platform\Models;

use Illuminate\Database\Eloquent\Model;

/** Offre d'abonnement et ses limites (§8.1). */
class Plan extends Model
{
    protected $guarded = [];

    protected $casts = [
        'price' => 'decimal:2',
        'is_recommended' => 'boolean',
        'is_active' => 'boolean',
    ];
}
