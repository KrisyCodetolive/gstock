<?php

namespace App\Domain\Stock\Models;

use App\Domain\Catalog\Models\Product;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AdjustmentItem extends Model
{
    public $timestamps = false;

    protected $guarded = [];

    protected $casts = ['quantity' => 'decimal:3', 'counted_quantity' => 'decimal:3'];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
