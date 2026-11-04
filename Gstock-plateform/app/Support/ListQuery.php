<?php

namespace App\Support;

use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Listes de l'API (§9) : `page`, `per_page` (100 au plus), `search`, `sort=-champ`,
 * `filter[x]`. Réponse `{data, meta: {current_page, per_page, total, last_page}}`.
 */
final class ListQuery
{
    /**
     * @param  list<string>  $searchIn  colonnes cherchées, sans tenir compte des accents ni de la casse
     * @param  array<string, Closure(Builder, string): void>  $filters
     * @param  list<string>  $sortable
     * @param  Closure(mixed): array  $toArray  transformation de chaque ligne
     */
    public static function respond(
        Request $request,
        Builder $query,
        Closure $toArray,
        array $searchIn = [],
        array $filters = [],
        array $sortable = [],
        string $defaultSort = 'id',
        array $extra = [],
    ): JsonResponse {
        $search = trim((string) $request->query('search', ''));
        if ($search !== '' && $searchIn !== []) {
            $query->where(function (Builder $q) use ($search, $searchIn) {
                foreach ($searchIn as $column) {
                    $q->orWhereRaw("unaccent(coalesce({$column}, '')) ILIKE unaccent(?)", ['%'.addcslashes($search, '%_\\').'%']);
                }
            });
        }

        foreach ((array) $request->query('filter', []) as $name => $value) {
            if (isset($filters[$name]) && $value !== null && $value !== '') {
                $filters[$name]($query, (string) $value);
            }
        }

        $sort = (string) $request->query('sort', $defaultSort);
        $column = ltrim($sort, '-');
        if (in_array($column, $sortable, true)) {
            $query->orderBy($column, str_starts_with($sort, '-') ? 'desc' : 'asc');
        }
        $query->orderBy($query->getModel()->getQualifiedKeyName());

        $perPage = min(100, max(1, (int) $request->query('per_page', 20)));
        $page = $query->paginate($perPage);

        return response()->json([
            'data' => array_map($toArray, $page->items()),
            'meta' => [
                'current_page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
                'last_page' => $page->lastPage(),
            ],
            ...$extra,
        ]);
    }

    /** Filtre booléen `filter[is_active]=true|false`. */
    public static function boolean(string $column): Closure
    {
        return fn (Builder $q, string $v) => $q->where($column, filter_var($v, FILTER_VALIDATE_BOOLEAN));
    }
}
