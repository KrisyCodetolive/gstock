<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Audit\Audit;
use App\Domain\Identity\Models\Permission;
use App\Domain\Identity\Models\Role;
use App\Http\Controllers\Controller;
use App\Http\Resources\Present;
use App\Support\ApiException;
use App\Support\ListQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Rôles libres sur des permissions prédéfinies (M04, ADR-014). Owner est protégé. */
class RoleController extends Controller
{
    /** GET /permissions : la liste fixe, en lecture seule. */
    public function permissions(): JsonResponse
    {
        return response()->json(['data' => Permission::query()->orderBy('id')->get(['name', 'label', 'level', 'group'])]);
    }

    public function index(Request $request): JsonResponse
    {
        // Owner en tête, puis ordre alphabétique.
        $query = Role::query()->with('permissions')->withCount('users')->orderByDesc('is_owner')->orderBy('name');

        return ListQuery::respond($request, $query, Present::role(...), searchIn: ['name', 'description']);
    }

    public function show(Role $role): JsonResponse
    {
        return response()->json(['data' => Present::role($role->loadCount('users'))]);
    }

    public function store(Request $request): JsonResponse
    {
        [$data, $permissions] = $this->validated($request);
        $role = DB::transaction(function () use ($data, $permissions, $request) {
            $role = Role::create([...$data, 'is_owner' => false]);
            $role->permissions()->sync(Permission::query()->whereIn('name', $permissions)->pluck('id'));
            Audit::record($request->user(), 'role.created', ['subject' => $role, 'label' => $role->name, 'new' => ['permissions' => $this->labels($permissions)]]);

            return $role;
        });

        return response()->json(['data' => Present::role($role->load('permissions')->loadCount('users'))], 201);
    }

    /** S'applique immédiatement à tous les utilisateurs qui ont ce rôle (M04). */
    public function update(Request $request, Role $role): JsonResponse
    {
        $this->refuseOwner($role);
        [$data, $permissions] = $this->validated($request, $role);
        $old = ['name' => $role->name, 'permissions' => $role->permissionNames()];

        DB::transaction(function () use ($role, $data, $permissions, $old, $request) {
            $role->update($data);
            $role->permissions()->sync(Permission::query()->whereIn('name', $permissions)->pluck('id'));
            // Dans le journal : les permissions ajoutées et retirées, en français.
            Audit::record($request->user(), 'role.updated', [
                'subject' => $role,
                'label' => $role->name,
                'old' => ['nom' => $old['name'], 'permissions_retirees' => $this->labels(array_diff($old['permissions'], $permissions))],
                'new' => ['nom' => $role->name, 'permissions_ajoutees' => $this->labels(array_diff($permissions, $old['permissions']))],
            ]);
        });

        return response()->json(['data' => Present::role($role->load('permissions')->loadCount('users'))]);
    }

    /** Un rôle attribué à au moins un utilisateur ne se supprime pas (ADR-014). */
    public function destroy(Request $request, Role $role): Response
    {
        $this->refuseOwner($role);
        $count = $role->users()->count();
        if ($count > 0) {
            $s = $count > 1 ? 's' : '';
            throw ApiException::conflict("Ce rôle est attribué à {$count} utilisateur{$s}. Donnez-leur un autre rôle avant de le supprimer.");
        }
        DB::transaction(function () use ($role, $request) {
            Audit::record($request->user(), 'role.deleted', ['subject' => $role, 'label' => $role->name, 'old' => ['permissions' => $this->labels($role->permissionNames())]]);
            $role->permissions()->detach();
            $role->delete();
        });

        return response()->noContent();
    }

    /** @return array{0: array{name: string, description: ?string}, 1: list<string>} */
    private function validated(Request $request, ?Role $current = null): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:255'],
            'permissions' => ['required', 'array', 'min:1'],
            'permissions.*' => ['string', 'exists:permissions,name'],
        ], [
            'name.required' => 'Donnez un nom au rôle.',
            'permissions.required' => 'Cochez au moins une permission.',
            'permissions.min' => 'Cochez au moins une permission.',
            'permissions.*.exists' => 'Une permission inconnue a été envoyée.',
        ]);
        $name = trim($data['name']);
        $normalized = Str::lower(Str::ascii($name));
        if (in_array($normalized, ['owner', 'proprietaire'], true)) {
            throw ApiException::invalid('name', 'Ce nom est réservé au rôle du propriétaire.');
        }
        $taken = Role::query()->when($current, fn ($q) => $q->whereKeyNot($current->id))
            ->whereRaw('lower(unaccent(name)) = lower(unaccent(?))', [$name])->exists();
        if ($taken) {
            throw ApiException::invalid('name', 'Un autre rôle porte déjà ce nom.');
        }

        return [
            ['name' => $name, 'description' => filled($data['description'] ?? null) ? trim($data['description']) : null],
            array_values(array_unique($data['permissions'])),
        ];
    }

    private function refuseOwner(Role $role): void
    {
        if ($role->is_owner) {
            throw ApiException::forbidden('Le rôle du propriétaire ne peut être ni modifié ni supprimé.');
        }
    }

    /** @param  array<string>  $names @return list<string> */
    private function labels(array $names): array
    {
        return Permission::query()->whereIn('name', $names)->orderBy('id')->pluck('label')->all();
    }
}
