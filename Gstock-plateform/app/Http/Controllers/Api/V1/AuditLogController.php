<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Audit\Models\AuditLog;
use App\Domain\Identity\Models\User;
use App\Http\Controllers\Controller;
use App\Http\Resources\Present;
use App\Support\ListQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Journal d'activité (M14). Les actions sans boutique ne sont visibles que du propriétaire. */
class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $shopIds = $user->accessibleShops()->pluck('id');
        $query = AuditLog::query()->with(['user', 'shop'])
            ->where(fn (Builder $q) => $user->isOwner()
                ? $q->whereNull('shop_id')->orWhereIn('shop_id', $shopIds)
                : $q->whereIn('shop_id', $shopIds))
            ->orderByDesc('created_at')->orderByDesc('id');
        // Recherche dans l'objet, le motif et le nom de l'auteur, sans tenir compte des accents.
        $search = trim((string) $request->query('search', ''));
        if ($search !== '') {
            $needle = '%'.addcslashes($search, '%_\\').'%';
            $query->where(fn (Builder $q) => $q->whereRaw("unaccent(coalesce(subject_label, '')) ILIKE unaccent(?)", [$needle])
                ->orWhereRaw("unaccent(coalesce(reason, '')) ILIKE unaccent(?)", [$needle])
                ->orWhereIn('user_id', User::query()->whereRaw("unaccent(firstname || ' ' || lastname) ILIKE unaccent(?)", [$needle])->select('id')));
        }

        return ListQuery::respond(
            $request,
            $query,
            Present::auditLog(...),
            filters: [
                'domain' => fn (Builder $q, string $v) => $q->where('action', 'like', addcslashes($v, '%_').'.%'),
                'user_id' => fn (Builder $q, string $v) => $q->where('user_id', (int) $v),
                'shop_id' => fn (Builder $q, string $v) => $q->where('shop_id', (int) $v),
                'from' => fn (Builder $q, string $v) => $q->where('created_at', '>=', $v),
            ],
        );
    }
}
