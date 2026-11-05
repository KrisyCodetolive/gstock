<?php

namespace App\Domain\Stock\Models;

use App\Domain\Catalog\Models\Product;
use App\Support\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Arrivage d'un produit suivi dans une boutique (§7.11) : une entrée de marchandise,
 * avec ou sans date de péremption. Seul le StockLedger change sa quantité.
 *
 * @property ?Carbon $expiry_date
 */
class StockLot extends Model
{
    use BelongsToTenant;

    protected $guarded = [];

    protected $casts = [
        'expiry_date' => 'date',
        'initial_quantity' => 'decimal:3',
        'quantity' => 'decimal:3',
        'unit_cost' => 'decimal:2',
        'received_at' => 'datetime',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
