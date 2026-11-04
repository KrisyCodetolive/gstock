<?php

namespace App\Domain\Stock\Models;

use App\Domain\Identity\Models\User;
use App\Support\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Mouvement manuel MS-N (M07) : entrée, sortie ou inventaire. Annulé, jamais supprimé (ADR-012). */
class Adjustment extends Model
{
    use BelongsToTenant;

    public const KINDS = ['entry', 'exit', 'inventory'];

    protected $guarded = [];

    protected $casts = ['occurred_at' => 'datetime', 'cancelled_at' => 'datetime'];

    public function items(): HasMany
    {
        return $this->hasMany(AdjustmentItem::class)->orderBy('id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
