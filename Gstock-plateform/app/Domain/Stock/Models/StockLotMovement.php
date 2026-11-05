<?php

namespace App\Domain\Stock\Models;

use App\Support\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/** Part d'un mouvement de stock prise dans (ou rendue à) un arrivage (§7.11). Jamais modifiée. */
class StockLotMovement extends Model
{
    use BelongsToTenant;

    public const UPDATED_AT = null;

    protected $guarded = [];

    protected $casts = ['quantity' => 'decimal:3'];
}
