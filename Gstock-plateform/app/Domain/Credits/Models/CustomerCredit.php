<?php

namespace App\Domain\Credits\Models;

use App\Domain\Customers\Models\Customer;
use App\Domain\Sales\Models\Sale;
use App\Domain\Shops\Models\Shop;
use App\Support\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Crédit client (§7.5, §7.6) : créé automatiquement par une vente avec un reste,
 * ou saisi comme ancienne dette. Annulé, jamais supprimé (ADR-012).
 *
 * @property string $remaining_amount
 */
class CustomerCredit extends Model
{
    use BelongsToTenant;

    protected $guarded = [];

    protected $casts = [
        'amount' => 'decimal:2',
        'remaining_amount' => 'decimal:2',
        'is_opening_balance' => 'boolean',
        'occurred_at' => 'datetime',
        'cancelled_at' => 'datetime',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }
}
