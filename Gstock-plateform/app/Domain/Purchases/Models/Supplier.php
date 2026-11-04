<?php

namespace App\Domain\Purchases\Models;

use App\Support\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Fournisseur (M11) : commun à l'espace. Désactivé, jamais supprimé. */
class Supplier extends Model
{
    use BelongsToTenant;

    protected $fillable = ['name', 'phone', 'address', 'note', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];

    public function purchases(): HasMany
    {
        return $this->hasMany(Purchase::class);
    }
}
