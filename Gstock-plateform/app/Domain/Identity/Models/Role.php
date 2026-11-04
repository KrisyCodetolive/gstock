<?php

namespace App\Domain\Identity\Models;

use App\Support\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Rôle libre créé par le propriétaire (ADR-014). Seul le rôle Owner est créé à
 * l'inscription : il a toutes les permissions et ne se modifie pas.
 *
 * @property bool $is_owner
 */
class Role extends Model
{
    use BelongsToTenant;

    protected $fillable = ['name', 'description', 'is_owner'];

    protected $casts = ['is_owner' => 'boolean'];

    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(Permission::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /** @return list<string> */
    public function permissionNames(): array
    {
        return $this->is_owner
            ? Permission::query()->orderBy('id')->pluck('name')->all()
            : $this->permissions->sortBy('id')->pluck('name')->values()->all();
    }
}
