<?php

namespace App\Domain\Catalog\Models;

use App\Support\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/** Marque (M05, mode avancé). */
class Brand extends Model
{
    use BelongsToTenant;

    protected $fillable = ['name', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];
}
