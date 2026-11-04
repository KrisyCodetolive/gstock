<?php

namespace App\Http\Controllers\Api\V1\Referentials;

use App\Domain\Catalog\Models\Product;
use App\Domain\Catalog\Models\Unit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

/** Unités (§7.3) : une unité dérivée se rattache à une unité de base, jamais à une autre dérivée. */
class UnitController extends ReferentialController
{
    protected function model(): string
    {
        return Unit::class;
    }

    protected function nameMessage(): string
    {
        return "Donnez un nom à l'unité.";
    }

    protected function query(): Builder
    {
        return Unit::query()->withCount('products');
    }

    protected function fields(Request $request, ?Model $current): array
    {
        $errors = [];
        // Une unité déjà utilisée par des produits garde sa conversion : les quantités en stock en dépendent (§7.3).
        if ($current && $this->conversionChanges($request, $current) && $this->usedByProducts($current)) {
            $this->fail(['operator_value' => 'Cette unité sert déjà à des produits : sa conversion ne peut plus changer. Créez une autre unité.']);
        }
        $short = trim((string) $request->input('short_name', ''));
        if ($short === '') {
            $errors['short_name'] = 'Donnez une abréviation, par exemple « ctn ».';
        }
        $baseId = $request->input('base_unit_id');
        if ($baseId === null || $baseId === '') {
            if ($errors) {
                $this->fail($errors);
            }

            return ['short_name' => $short, 'base_unit_id' => null, 'operator' => null, 'operator_value' => null];
        }

        $base = Unit::query()->find((int) $baseId);
        if (! $base || $base->base_unit_id !== null || $base->id === $current?->getKey()) {
            $errors['base_unit_id'] = 'Choisissez une unité de base.';
        }
        $operator = $request->input('operator');
        if (! in_array($operator, ['*', '/'], true)) {
            $errors['operator'] = 'Choisissez comment les deux unités se comparent.';
        }
        $value = $request->input('operator_value');
        if (! is_numeric($value) || (float) $value <= 0) {
            $errors['operator_value'] = 'Saisissez un nombre supérieur à 0.';
        }
        if ($current && Unit::query()->where('base_unit_id', $current->getKey())->exists()) {
            $errors['base_unit_id'] = "D'autres unités dépendent de celle-ci : elle doit rester une unité de base.";
        }
        if ($errors) {
            $this->fail($errors);
        }

        return ['short_name' => $short, 'base_unit_id' => $base->id, 'operator' => $operator, 'operator_value' => (string) $value];
    }

    private function conversionChanges(Request $request, Model $current): bool
    {
        $baseId = $request->input('base_unit_id');
        $baseId = $baseId === null || $baseId === '' ? null : (int) $baseId;
        if ($baseId !== $current->base_unit_id) {
            return true;
        }

        return $baseId !== null && ($request->input('operator') !== $current->operator
            || bccomp((string) $request->input('operator_value'), (string) $current->operator_value, 3) !== 0);
    }

    private function usedByProducts(Model $unit): bool
    {
        return Product::query()->where('unit_id', $unit->getKey())->orWhere('purchase_unit_id', $unit->getKey())->exists();
    }

    /** `operator_value` sans zéros inutiles (« 12 », « 1000 »). */
    protected function present(Model $row): array
    {
        $value = $row->operator_value === null ? null : rtrim(rtrim((string) $row->operator_value, '0'), '.');

        return [
            ...$row->only(['id', 'name', 'short_name', 'base_unit_id', 'operator']),
            'operator_value' => $value,
            'is_active' => $row->is_active,
            'products_count' => (int) ($row->products_count ?? 0),
        ];
    }
}
