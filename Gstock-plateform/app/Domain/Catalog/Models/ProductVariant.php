<?php

namespace App\Domain\Catalog\Models;

use App\Support\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Variante d'un produit `variable` : son prix, son code-barres, son stock. Désactivée, jamais supprimée. */
class ProductVariant extends Model
{
    use BelongsToTenant;

    protected $fillable = ['product_id', 'name', 'code', 'barcode', 'cost', 'price', 'is_active'];

    protected $casts = ['cost' => 'decimal:2', 'price' => 'decimal:2', 'is_active' => 'boolean'];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
