<?php

namespace App\Domain\Sales\Models;

use App\Domain\Credits\Models\CustomerCredit;
use App\Domain\Customers\Models\Customer;
use App\Domain\Identity\Models\User;
use App\Domain\Shops\Models\Shop;
use App\Support\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/** Vente V-N (M08). Validée, elle n'est jamais modifiée ni supprimée : elle s'annule (ADR-012). */
class Sale extends Model
{
    use BelongsToTenant;

    protected $guarded = [];

    protected $casts = [
        'subtotal' => 'decimal:2', 'discount' => 'decimal:2', 'tax_amount' => 'decimal:2', 'total' => 'decimal:2',
        'paid_now' => 'decimal:2', 'credit_amount' => 'decimal:2',
        'review_reasons' => 'array', 'occurred_at' => 'datetime', 'cancelled_at' => 'datetime',
    ];

    public function items(): HasMany
    {
        return $this->hasMany(SaleItem::class)->orderBy('id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(SalePayment::class)->orderBy('id');
    }

    public function credit(): HasOne
    {
        return $this->hasOne(CustomerCredit::class);
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
