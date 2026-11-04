<?php

namespace App\Domain\Shops\Models;

use App\Domain\Identity\Models\User;
use App\Support\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * Boutique d'un espace (ADR-011). Jamais supprimée : désactivée, elle disparaît
 * du sélecteur et n'accepte plus d'opération.
 *
 * @property int $id
 * @property bool $is_active
 */
class Shop extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'name', 'city', 'district', 'address', 'phone', 'receipt_note', 'receipt_show_customer',
        'receipt_show_phone', 'auto_print_receipt', 'default_customer_id', 'is_active',
    ];

    protected $casts = [
        'receipt_show_customer' => 'boolean',
        'receipt_show_phone' => 'boolean',
        'auto_print_receipt' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class);
    }
}
