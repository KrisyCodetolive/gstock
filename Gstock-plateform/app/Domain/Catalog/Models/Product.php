<?php

namespace App\Domain\Catalog\Models;

use App\Support\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

/**
 * Produit du catalogue, commun à toutes les boutiques (M06). Désactivé, jamais
 * supprimé. `simple` et `variable` ont du stock, `service` n'en a pas.
 *
 * @property int $id
 * @property string $type simple|variable|service
 * @property string $name
 * @property ?string $cost
 * @property string $price
 * @property ?string $stock_alert
 * @property bool $track_expiry dates de péremption suivies (§7.11)
 * @property ?int $expiry_alert_days
 */
class Product extends Model
{
    use BelongsToTenant;

    public const TYPES = ['simple', 'variable', 'service'];

    protected $fillable = [
        'type', 'name', 'code', 'barcode', 'category_id', 'brand_id', 'unit_id', 'sale_unit_id', 'purchase_unit_id',
        'cost', 'price', 'tax_rate', 'tax_method', 'stock_alert', 'image_path', 'is_active', 'track_expiry', 'expiry_alert_days',
    ];

    protected $casts = [
        'cost' => 'decimal:2',
        'price' => 'decimal:2',
        'tax_rate' => 'decimal:2',
        'stock_alert' => 'decimal:3',
        'is_active' => 'boolean',
        'track_expiry' => 'boolean',
        'expiry_alert_days' => 'integer',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function purchaseUnit(): BelongsTo
    {
        return $this->belongsTo(Unit::class, 'purchase_unit_id');
    }

    public function variants(): HasMany
    {
        return $this->hasMany(ProductVariant::class)->orderBy('id');
    }

    public function isStockable(): bool
    {
        return $this->type !== 'service';
    }

    /** Ce qui porte du stock : le produit (null), ou chacune de ses variantes. */
    public function stockKeys(): array
    {
        if (! $this->isStockable()) {
            return [];
        }

        return $this->type === 'variable' ? $this->variants->pluck('id')->all() : [null];
    }

    public function imageUrl(): ?string
    {
        return $this->image_path ? Storage::disk('public')->url($this->image_path) : null;
    }

    /** Nom affiché d'un article : « Jus de fruits 1 L — Bissap ». */
    public function articleName(?int $variantId): string
    {
        $variant = $variantId ? $this->variants->firstWhere('id', $variantId) : null;

        return $variant ? "{$this->name} — {$variant->name}" : $this->name;
    }
}
