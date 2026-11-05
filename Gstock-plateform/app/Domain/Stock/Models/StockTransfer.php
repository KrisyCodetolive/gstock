<?php

namespace App\Domain\Stock\Models;

use App\Domain\Identity\Models\User;
use App\Domain\Shops\Models\Shop;
use App\Support\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Transfert de stock TR-N entre deux boutiques de l'espace (§7.12). Jamais supprimé. */
class StockTransfer extends Model
{
    use BelongsToTenant;

    public const STATUSES = ['in_transit', 'received', 'cancelled'];

    protected $guarded = [];

    protected $casts = ['sent_at' => 'datetime', 'received_at' => 'datetime', 'cancelled_at' => 'datetime'];

    public function items(): HasMany
    {
        return $this->hasMany(StockTransferItem::class)->orderBy('id');
    }

    public function fromShop(): BelongsTo
    {
        return $this->belongsTo(Shop::class, 'from_shop_id');
    }

    public function toShop(): BelongsTo
    {
        return $this->belongsTo(Shop::class, 'to_shop_id');
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sent_by');
    }

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }
}
