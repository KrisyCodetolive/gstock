<?php

namespace App\Domain\Catalog\Models;

use App\Support\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/** Catégorie de produits (M05) : un nom et une teinte de vignette. */
class Category extends Model
{
    use BelongsToTenant;

    public const COLORS = ['peach', 'yellow', 'mint', 'lavender'];

    protected $fillable = ['name', 'color', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];
}
