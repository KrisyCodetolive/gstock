<?php

namespace App\Http\Controllers\Api\V1\Referentials;

use App\Http\Controllers\Controller;
use App\Support\ApiException;
use App\Support\ListQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Référentiel de l'espace (M05) : liste, création, modification. Pas de
 * suppression : un élément utilisé se désactive. Nom unique dans la liste
 * (sans tenir compte des majuscules ni des accents).
 */
abstract class ReferentialController extends Controller
{
    /** @return class-string<Model> */
    abstract protected function model(): string;

    /** Message si le nom manque. */
    abstract protected function nameMessage(): string;

    /** Champs propres au référentiel, validés (422 en français si besoin). */
    protected function fields(Request $request, ?Model $current): array
    {
        return [];
    }

    /** Requête de base (ex. avec le nombre de produits). */
    protected function query(): Builder
    {
        return $this->model()::query();
    }

    protected function present(Model $row): array
    {
        return $row->only(['id', 'name', ...array_diff($row->getFillable(), ['name'])]);
    }

    public function index(Request $request): JsonResponse
    {
        return ListQuery::respond(
            $request,
            $this->query(),
            fn (Model $row) => $this->present($row),
            searchIn: ['name'],
            filters: ['is_active' => ListQuery::boolean('is_active')],
            sortable: ['name'],
            defaultSort: 'id',
        );
    }

    public function store(Request $request): JsonResponse
    {
        $row = $this->model()::create($this->validated($request));

        return response()->json(['data' => $this->present($this->query()->findOrFail($row->getKey()))], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $row = $this->model()::query()->findOrFail($id);
        $row->update($this->validated($request, $row));

        return response()->json(['data' => $this->present($this->query()->findOrFail($row->getKey()))]);
    }

    private function validated(Request $request, ?Model $current = null): array
    {
        $name = trim((string) $request->input('name', ''));
        $errors = [];
        if ($name === '') {
            $errors['name'] = [$this->nameMessage()];
        } elseif ($this->model()::query()
            ->when($current, fn ($q) => $q->whereKeyNot($current->getKey()))
            ->whereRaw('lower(unaccent(name)) = lower(unaccent(?))', [$name])->exists()) {
            $errors['name'] = ['Ce nom existe déjà dans la liste.'];
        }

        try {
            $fields = $this->fields($request, $current);
        } catch (ApiException $e) {
            $errors = [...$errors, ...$e->errors];
            $fields = [];
        }
        if ($errors) {
            throw new ApiException(422, 'Les informations saisies ne sont pas valides.', $errors);
        }

        return [...$fields, 'name' => $name, 'is_active' => $request->input('is_active') !== false];
    }

    /** Lève une seule erreur 422 regroupant toutes celles des champs. */
    protected function fail(array $errors): never
    {
        throw new ApiException(422, 'Les informations saisies ne sont pas valides.', array_map(fn ($m) => [$m], $errors));
    }
}
