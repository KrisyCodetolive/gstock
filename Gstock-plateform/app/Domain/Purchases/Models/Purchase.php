<?php

namespace App\Domain\Purchases\Models;

use App\Domain\Identity\Models\User;
use App\Domain\Shops\Models\Shop;
use App\Support\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Approvisionnement AP-N (M11) : le stock augmente à l'enregistrement. Annulé, jamais supprimé (ADR-012). */
class Purchase extends Model
{
    use BelongsToTenant;

    /** Type de l'échéancier dans `installments` (§7.7). */
    public const PAYABLE = 'purchase';

    protected $guarded = [];

    protected $casts = [
        'occurred_at' => 'datetime', 'cancelled_at' => 'datetime',
        'subtotal' => 'decimal:2', 'discount' => 'decimal:2', 'tax_amount' => 'decimal:2', 'total' => 'decimal:2', 'paid_amount' => 'decimal:2',
    ];

    public function items(): HasMany
    {
        return $this->hasMany(PurchaseItem::class)->orderBy('id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(PurchasePayment::class)->orderBy('id');
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
