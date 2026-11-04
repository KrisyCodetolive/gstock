<?php

namespace App\Domain\Purchases\Models;

use App\Domain\Identity\Models\User;
use App\Domain\Sales\Models\PaymentMethod;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Paiement à un fournisseur, jamais au-delà du reste dû. */
class PurchasePayment extends Model
{
    protected $guarded = [];

    protected $casts = ['amount' => 'decimal:2', 'paid_at' => 'datetime'];

    public function method(): BelongsTo
    {
        return $this->belongsTo(PaymentMethod::class, 'payment_method_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
