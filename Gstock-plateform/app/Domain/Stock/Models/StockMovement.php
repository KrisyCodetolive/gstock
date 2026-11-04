<?php

namespace App\Domain\Stock\Models;

use App\Domain\Catalog\Models\Product;
use App\Domain\Identity\Models\User;
use App\Support\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Mouvement de stock (§7.2) : écrit une fois, jamais modifié ni supprimé. */
class StockMovement extends Model
{
    use BelongsToTenant;

    public const UPDATED_AT = null;

    protected $guarded = [];

    protected $casts = ['quantity' => 'decimal:3', 'unit_cost' => 'decimal:2', 'occurred_at' => 'datetime'];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
