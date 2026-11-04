<?php

namespace App\Domain\Purchases\Models;

use App\Domain\Catalog\Models\Product;
use App\Domain\Catalog\Models\Unit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Ligne d'approvisionnement : quantité et prix dans l'unité de la ligne, `base_quantity` en unité de base. */
class PurchaseItem extends Model
{
    public $timestamps = false;

    protected $guarded = [];

    protected $casts = ['quantity' => 'decimal:3', 'base_quantity' => 'decimal:3', 'cost' => 'decimal:2', 'subtotal' => 'decimal:2'];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }
}
