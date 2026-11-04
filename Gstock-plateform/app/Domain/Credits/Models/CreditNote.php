<?php

namespace App\Domain\Credits\Models;

use App\Support\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/** Mouvement d'avoir (P3) : + créé (annulation), − utilisé (paiement). Le solde est la somme. */
class CreditNote extends Model
{
    use BelongsToTenant;

    public const UPDATED_AT = null;

    protected $guarded = [];

    protected $casts = ['amount' => 'decimal:2', 'created_at' => 'datetime'];
}
