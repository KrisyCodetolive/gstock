<?php

namespace App\Domain\Catalog\Models;

use App\Support\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Unité (§7.3). Une unité dérivée se rattache à une unité de base :
 * Carton = Unité × 12, Gramme = Kilogramme ÷ 1000. Le stock est toujours tenu
 * dans l'unité de base.
 *
 * @property ?int $base_unit_id
 * @property ?string $operator
 * @property ?string $operator_value
 */
class Unit extends Model
{
    use BelongsToTenant;

    protected $fillable = ['name', 'short_name', 'base_unit_id', 'operator', 'operator_value', 'is_active'];

    protected $casts = ['is_active' => 'boolean', 'operator_value' => 'decimal:3'];

    public function baseUnit(): BelongsTo
    {
        return $this->belongsTo(self::class, 'base_unit_id');
    }

    public function derivedUnits(): HasMany
    {
        return $this->hasMany(self::class, 'base_unit_id');
    }

    /** Nombre d'unités de base dans cette unité : 12 pour le carton, 0,001 pour le gramme. */
    public function factor(): string
    {
        if ($this->base_unit_id === null || $this->operator_value === null) {
            return '1';
        }

        return $this->operator === '/' ? bcdiv('1', (string) $this->operator_value, 6) : (string) $this->operator_value;
    }
}
