<?php

namespace App\Domain\Credits\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Part d'un paiement appliquée à un crédit. */
class CreditRepaymentAllocation extends Model
{
    public $timestamps = false;

    protected $guarded = [];

    protected $casts = ['amount' => 'decimal:2'];

    public function credit(): BelongsTo
    {
        return $this->belongsTo(CustomerCredit::class, 'customer_credit_id');
    }

    public function repayment(): BelongsTo
    {
        return $this->belongsTo(CreditRepayment::class, 'credit_repayment_id');
    }
}
