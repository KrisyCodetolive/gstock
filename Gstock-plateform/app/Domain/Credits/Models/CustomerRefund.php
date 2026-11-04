<?php

namespace App\Domain\Credits\Models;

use App\Domain\Identity\Models\User;
use App\Domain\Sales\Models\PaymentMethod;
use App\Support\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Argent rendu au client à l'annulation d'un crédit déjà en partie payé (P3). */
class CustomerRefund extends Model
{
    use BelongsToTenant;

    public const UPDATED_AT = null;

    protected $guarded = [];

    protected $casts = ['amount' => 'decimal:2', 'created_at' => 'datetime'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function method(): BelongsTo
    {
        return $this->belongsTo(PaymentMethod::class, 'payment_method_id');
    }

    public function credit(): BelongsTo
    {
        return $this->belongsTo(CustomerCredit::class, 'customer_credit_id');
    }
}
