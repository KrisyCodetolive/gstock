<?php

namespace App\Domain\Expenses\Models;

use App\Support\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/** Catégorie de dépenses (M05, §8.7). */
class ExpenseCategory extends Model
{
    use BelongsToTenant;

    protected $fillable = ['name', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];
}
