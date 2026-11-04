<?php

namespace App\Domain\Expenses\Models;

use App\Domain\Identity\Models\User;
use App\Domain\Sales\Models\PaymentMethod;
use App\Support\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Dépense DP-N (M12). Faisable hors ligne (`offline_uuid`). Annulée, jamais supprimée (ADR-012). */
class Expense extends Model
{
    use BelongsToTenant;

    protected $guarded = [];

    protected $casts = ['amount' => 'decimal:2', 'occurred_at' => 'datetime', 'cancelled_at' => 'datetime'];

    public function category(): BelongsTo
    {
        return $this->belongsTo(ExpenseCategory::class, 'expense_category_id');
    }

    public function method(): BelongsTo
    {
        return $this->belongsTo(PaymentMethod::class, 'payment_method_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
