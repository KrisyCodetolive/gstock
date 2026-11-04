<?php

namespace App\Domain\Sales\Models;

use App\Domain\Catalog\Models\Product;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SaleItem extends Model
{
    public $timestamps = false;

    protected $guarded = [];

    protected $casts = [
        'quantity' => 'decimal:3', 'base_quantity' => 'decimal:3', 'price' => 'decimal:2', 'unit_cost' => 'decimal:2',
        'discount' => 'decimal:2', 'discount_amount' => 'decimal:2', 'tax_rate' => 'decimal:2', 'tax_amount' => 'decimal:2', 'subtotal' => 'decimal:2',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
