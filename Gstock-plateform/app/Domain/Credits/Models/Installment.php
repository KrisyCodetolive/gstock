<?php

namespace App\Domain\Credits\Models;

use App\Support\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/** Échéance d'un crédit client ou d'une dette fournisseur (§7.7) ; son état est calculé à la lecture. */
class Installment extends Model
{
    use BelongsToTenant;

    protected $guarded = [];

    protected $casts = ['amount' => 'decimal:2', 'due_date' => 'date', 'frozen' => 'boolean'];
}
