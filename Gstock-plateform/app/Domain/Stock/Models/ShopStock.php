<?php

namespace App\Domain\Stock\Models;

use App\Domain\Catalog\Models\Product;
use App\Domain\Catalog\Models\ProductVariant;
use App\Support\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Stock d'un article dans une boutique, en unité de base (§7.2). Seul le
 * StockLedger le modifie : la quantité égale toujours la somme des mouvements.
 */
class ShopStock extends Model
{
    use BelongsToTenant;

    protected $table = 'shop_stock';

    protected $fillable = ['shop_id', 'product_id', 'product_variant_id', 'quantity', 'stock_alert'];

    protected $casts = ['quantity' => 'decimal:3', 'stock_alert' => 'decimal:3'];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }
}
