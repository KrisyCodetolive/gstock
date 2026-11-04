<?php

namespace App\Domain\Platform\Models;

use App\Domain\Platform\SubscriptionState;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Abonnement d'un espace à un plan (§8.1). */
class TenantSubscription extends Model
{
    protected $guarded = [];

    protected $casts = [
        'starts_at' => 'datetime',
        'trial_ends_at' => 'datetime',
        'ends_at' => 'datetime',
    ];

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function state(): SubscriptionState
    {
        return SubscriptionState::of($this);
    }
}
