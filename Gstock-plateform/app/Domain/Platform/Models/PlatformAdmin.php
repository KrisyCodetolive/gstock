<?php

namespace App\Domain\Platform\Models;

use Filament\Models\Contracts\FilamentUser;
use Filament\Panel;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

/** Super-admin de Genius Groups (M01) : seul un compte actif accède au back-office. */
class PlatformAdmin extends Authenticatable implements FilamentUser
{
    use Notifiable;

    protected $fillable = ['name', 'email', 'password', 'is_active', 'last_login_at'];

    protected $hidden = ['password', 'remember_token'];

    protected $casts = ['password' => 'hashed', 'is_active' => 'boolean', 'last_login_at' => 'datetime'];

    public function canAccessPanel(Panel $panel): bool
    {
        return $this->is_active;
    }
}
