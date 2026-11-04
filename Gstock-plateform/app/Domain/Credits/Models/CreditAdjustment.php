<?php

namespace App\Domain\Credits\Models;

use App\Domain\Identity\Models\User;
use App\Support\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Régularisation d'un crédit (geste commercial ou erreur), avec un motif. */
class CreditAdjustment extends Model
{
    use BelongsToTenant;

    public const UPDATED_AT = null;

    protected $guarded = [];

    protected $casts = ['amount' => 'decimal:2', 'created_at' => 'datetime'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
