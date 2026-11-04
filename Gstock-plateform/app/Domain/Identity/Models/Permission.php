<?php

namespace App\Domain\Identity\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Permission prédéfinie (ADR-014) : table globale remplie par migration,
 * jamais créée, modifiée ni supprimée par l'interface.
 */
class Permission extends Model
{
    protected $guarded = ['*'];
}
