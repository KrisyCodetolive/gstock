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

        return ListQuery::respond(
            $request,
            $query,
            Present::auditLog(...),
            searchIn: ['subject_label', 'reason'],
            filters: [
                'domain' => fn (Builder $q, string $v) => $q->where('action', 'like', addcslashes($v, '%_').'.%'),
                'user_id' => fn (Builder $q, string $v) => $q->where('user_id', (int) $v),
                'shop_id' => fn (Builder $q, string $v) => $q->where('shop_id', (int) $v),
                'from' => fn (Builder $q, string $v) => $q->where('created_at', '>=', $v),
            ],
        );
    }
}
