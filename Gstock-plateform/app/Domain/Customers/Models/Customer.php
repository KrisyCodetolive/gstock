<?php

namespace App\Domain\Customers\Models;

use App\Domain\Credits\Models\CustomerCredit;
use App\Support\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Client, commun à l'espace (M10) ; ses crédits sont suivis par boutique. Désactivé, jamais supprimé. */
class Customer extends Model
{
    use BelongsToTenant;

    protected $fillable = ['name', 'phone', 'district', 'note', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];

    public function credits(): HasMany
    {
        return $this->hasMany(CustomerCredit::class);
    }
}
