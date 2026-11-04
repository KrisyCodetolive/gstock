<?php

namespace App\Domain\Credits\Models;

use App\Domain\Customers\Models\Customer;
use App\Domain\Identity\Models\User;
use App\Domain\Sales\Models\PaymentMethod;
use App\Domain\Shops\Models\Shop;
use App\Support\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Paiement de crédit RB-N (§7.6) : réparti sur un ou plusieurs crédits. Annulé, jamais supprimé. */
class CreditRepayment extends Model
{
    use BelongsToTenant;

    protected $guarded = [];

    protected $casts = ['amount' => 'decimal:2', 'received_at' => 'datetime', 'cancelled_at' => 'datetime'];

    public function allocations(): HasMany
    {
        return $this->hasMany(CreditRepaymentAllocation::class)->orderBy('id');
    }

    public function method(): BelongsTo
    {
        return $this->belongsTo(PaymentMethod::class, 'payment_method_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
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
