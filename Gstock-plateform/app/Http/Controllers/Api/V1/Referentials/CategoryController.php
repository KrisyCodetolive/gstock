<?php

namespace App\Http\Controllers\Api\V1\Referentials;

use App\Domain\Catalog\Models\Category;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class CategoryController extends ReferentialController
{
    protected function model(): string
    {
        return Category::class;
    }

    protected function nameMessage(): string
    {
        return 'Donnez un nom à la catégorie.';
    }

    protected function fields(Request $request, ?Model $current): array
    {
        $color = (string) $request->input('color');

        return ['color' => in_array($color, Category::COLORS, true) ? $color : 'lavender'];
    }

    /** `products_count` : renseigné avec le module Produits (B3). */
    protected function present(Model $row): array
    {
        return [...$row->only(['id', 'name', 'color', 'is_active']), 'products_count' => (int) ($row->products_count ?? 0)];
    }
}
