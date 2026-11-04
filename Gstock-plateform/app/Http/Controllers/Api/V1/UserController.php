<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Audit\Audit;
use App\Domain\Identity\Models\Role;
use App\Domain\Identity\Models\User;
use App\Domain\Platform\CurrentTenant;
use App\Domain\Shops\Models\Shop;
use App\Http\Controllers\Controller;
use App\Http\Resources\Present;
use App\Support\ApiException;
use App\Support\ListQuery;
use App\Support\Phone;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** Utilisateurs de l'espace, leur rôle et leurs boutiques (M04). */
class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return ListQuery::respond(
            $request,
            User::query()->with(['role', 'shops']),
            Present::user(...),
            searchIn: ['firstname', 'lastname', 'email', 'phone'],
            filters: [
                'role_id' => fn (Builder $q, string $v) => $q->where('role_id', (int) $v),
                // Le propriétaire a accès à toutes les boutiques.
                'shop_id' => fn (Builder $q, string $v) => $q->where(fn ($w) => $w
                    ->whereHas('shops', fn ($s) => $s->whereKey((int) $v))
                    ->orWhereHas('role', fn ($r) => $r->where('is_owner', true))),
                'is_active' => ListQuery::boolean('is_active'),
            ],
            sortable: ['firstname', 'lastname', 'last_login_at'],
        );
    }

    public function show(User $user): JsonResponse
    {
        return response()->json(['data' => Present::user($user->load(['role', 'shops']))]);
    }

    /** Sans affectation, aucun accès : les boutiques se donnent ensuite (PUT /users/{id}/shops). */
    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $max = CurrentTenant::plan()->max_users;
        if (User::query()->count() >= $max) {
            throw ApiException::invalid('firstname', "Votre abonnement permet {$max} utilisateurs au maximum.");
        }
        $user = User::create([...$data, 'is_active' => true]);

        return response()->json(['data' => Present::user($user->load(['role', 'shops']))], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $this->refuseOwnerTarget($user, $request->user());
        $data = $this->validated($request, $user);
        if (empty($data['password'])) {
            unset($data['password']);
        }
        $oldRole = $user->role;

        DB::transaction(function () use ($user, $data, $oldRole, $request) {
            $user->update($data);
            if ($oldRole->id !== $user->role_id) {
                Audit::record($request->user(), 'user.role_changed', [
                    'subject' => $user, 'label' => $user->name(),
                    'old' => ['role' => $oldRole->name], 'new' => ['role' => $user->fresh('role')->role->name],
                ]);
            }
        });

        return response()->json(['data' => Present::user($user->fresh(['role', 'shops']))]);
    }

    /** Désactivé, l'utilisateur perd ses sessions (middleware « active »). */
    public function status(Request $request, User $user): JsonResponse
    {
        if ($user->isOwner()) {
            throw ApiException::forbidden('Le compte du propriétaire ne peut pas être désactivé.');
        }
        if ($user->is($request->user())) {
            throw ApiException::forbidden('Vous ne pouvez pas désactiver votre propre compte.');
        }
        $active = $request->boolean('is_active');
        if ($user->is_active !== $active) {
            DB::transaction(function () use ($user, $active, $request) {
                $user->update(['is_active' => $active]);
                if (! $active) {
                    DB::table('sessions')->where('user_id', $user->id)->delete();
                    $user->tokens()->delete();
                }
                Audit::record($request->user(), $active ? 'user.activated' : 'user.deactivated', ['subject' => $user, 'label' => $user->name()]);
            });
        }

        return response()->json(['data' => Present::user($user->fresh(['role', 'shops']))]);
    }

    public function shops(Request $request, User $user): JsonResponse
    {
        $this->refuseOwnerTarget($user, $request->user());
        $ids = array_values(array_unique(array_map('intval', (array) $request->input('shop_ids', []))));
        if (Shop::query()->whereKey($ids)->count() !== count($ids)) {
            throw ApiException::invalid('shop_ids', 'Une boutique choisie n’existe pas.');
        }
        $names = fn (array $shopIds) => Shop::query()->whereKey($shopIds)->orderBy('id')->pluck('name')->all();
        $old = $user->shops()->pluck('shops.id')->all();

        DB::transaction(function () use ($user, $ids, $old, $names, $request) {
            $user->shops()->sync($ids);
            if ($names($old) !== $names($ids)) {
                Audit::record($request->user(), 'user.shops_changed', [
                    'subject' => $user, 'label' => $user->name(),
                    'old' => ['boutiques' => $names($old)], 'new' => ['boutiques' => $names($ids)],
                ]);
            }
        });

        return response()->json(['data' => Present::user($user->fresh(['role', 'shops']))]);
    }

    /** Le compte du propriétaire n'est modifiable que par lui-même (§6.2). */
    private function refuseOwnerTarget(User $target, User $actor): void
    {
        if ($target->isOwner() && ! $target->is($actor)) {
            throw ApiException::forbidden('Le compte du propriétaire ne peut pas être modifié par un autre utilisateur.');
        }
    }

    private function validated(Request $request, ?User $current = null): array
    {
        $tenantId = CurrentTenant::get()->id;
        $request->merge([
            'email' => ($e = trim((string) $request->input('email'))) === '' ? null : mb_strtolower($e),
            'phone' => Phone::normalize($request->input('phone')),
        ]);
        $data = $request->validate([
            'firstname' => ['required', 'string', 'max:100'],
            'lastname' => ['required', 'string', 'max:100'],
            'email' => ['nullable', 'email', 'required_without:phone', Rule::unique('users')->where('tenant_id', $tenantId)->ignore($current?->id)],
            'phone' => ['nullable', 'regex:/^\d{8,12}$/', Rule::unique('users')->where('tenant_id', $tenantId)->ignore($current?->id)],
            'role_id' => ['required', 'integer'],
            'password' => [$current ? 'nullable' : 'required', 'string', 'min:8'],
        ], [
            'firstname.required' => 'Saisissez le prénom.',
            'lastname.required' => 'Saisissez le nom.',
            'email.required_without' => 'Saisissez un e-mail ou un numéro de téléphone pour la connexion.',
            'email.email' => "Cette adresse e-mail n'est pas valide.",
            'email.unique' => 'Cet e-mail est déjà utilisé par un autre utilisateur.',
            'phone.regex' => "Ce numéro de téléphone n'est pas valide.",
            'phone.unique' => 'Ce numéro est déjà utilisé par un autre utilisateur.',
            'role_id.required' => 'Choisissez un rôle.',
            'password.required' => 'Le mot de passe doit contenir au moins 8 caractères.',
            'password.min' => 'Le mot de passe doit contenir au moins 8 caractères.',
        ]);

        $role = Role::query()->find($data['role_id']);
        if (! $role) {
            throw ApiException::invalid('role_id', 'Choisissez un rôle.');
        }
        $currentIsOwner = $current?->isOwner() ?? false;
        if ($role->is_owner && ! $currentIsOwner) {
            throw ApiException::invalid('role_id', 'Le rôle du propriétaire est réservé au créateur de l’espace.');
        }
        if ($currentIsOwner && ! $role->is_owner) {
            throw ApiException::invalid('role_id', 'Le propriétaire garde son rôle.');
        }

        return [...$data, 'firstname' => trim($data['firstname']), 'lastname' => trim($data['lastname'])];
    }
}
