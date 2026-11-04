<?php

namespace App\Domain\Identity\Models;

use App\Domain\Shops\Models\Shop;
use App\Support\BelongsToTenant;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\HasApiTokens;

/**
 * Utilisateur d'un espace : un seul rôle, valable dans toutes les boutiques
 * auxquelles il est affecté (ADR-014). Se connecte par e-mail ou par téléphone.
 *
 * @property int $id
 * @property string $firstname
 * @property string $lastname
 * @property ?string $email
 * @property ?string $phone
 * @property bool $is_active
 * @property Role $role
 */
class User extends Authenticatable
{
    use BelongsToTenant, HasApiTokens, Notifiable;

    protected $fillable = ['firstname', 'lastname', 'email', 'phone', 'password', 'role_id', 'is_active'];

    protected $hidden = ['password', 'remember_token'];

    /** @var list<string>|null Permissions du rôle, chargées une fois par requête. */
    private ?array $permissionCache = null;

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'is_active' => 'boolean',
            'last_login_at' => 'datetime',
        ];
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    /** Boutiques affectées (le propriétaire a accès à toutes, voir accessibleShops). */
    public function shops(): BelongsToMany
    {
        return $this->belongsToMany(Shop::class);
    }

    public function name(): string
    {
        return trim("{$this->firstname} {$this->lastname}");
    }

    public function isOwner(): bool
    {
        return (bool) $this->role?->is_owner;
    }

    /** @return list<string> */
    public function permissionNames(): array
    {
        return $this->permissionCache ??= $this->role->permissionNames();
    }

    /** Vrai si l'une des permissions est accordée par le rôle (§6.2). */
    public function hasAnyPermission(string ...$permissions): bool
    {
        return array_intersect($permissions, $this->permissionNames()) !== [];
    }

    /** Boutiques ouvertes accessibles : toutes pour le propriétaire, sinon les affectées (§6.2). */
    public function accessibleShops(): Collection
    {
        $query = Shop::query()->where('is_active', true)->orderBy('id');

        return $this->isOwner() ? $query->get() : $query->whereIn('id', $this->shops()->select('shops.id'))->get();
    }

    public function canAccessShop(Shop $shop): bool
    {
        return $shop->is_active && ($this->isOwner() || $this->shops()->whereKey($shop->id)->exists());
    }

    public function avatarUrl(): ?string
    {
        return $this->avatar_path ? Storage::disk('public')->url($this->avatar_path) : null;
    }

    public function forgetPermissionCache(): void
    {
        $this->permissionCache = null;
    }
}
