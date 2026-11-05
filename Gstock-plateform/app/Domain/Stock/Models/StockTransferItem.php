<?php

namespace App\Domain\Stock\Models;

use App\Domain\Catalog\Models\Product;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Ligne d'un transfert : quantité envoyée, puis reçue, en unité de base. */
class StockTransferItem extends Model
{
    public $timestamps = false;

    protected $guarded = [];

    protected $casts = ['quantity' => 'decimal:3', 'received_quantity' => 'decimal:3', 'unit_cost' => 'decimal:2'];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
