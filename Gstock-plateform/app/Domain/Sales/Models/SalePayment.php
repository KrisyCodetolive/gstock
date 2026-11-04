<?php

namespace App\Domain\Sales\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Paiement d'une vente. GeniusPay : « pending » jusqu'au webhook (ADR-003). */
class SalePayment extends Model
{
    protected $guarded = [];

    protected $casts = ['amount' => 'decimal:2', 'cash_given' => 'decimal:2', 'change' => 'decimal:2'];

    public function method(): BelongsTo
    {
        return $this->belongsTo(PaymentMethod::class, 'payment_method_id');
    }
}
