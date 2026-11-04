<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Identity\Models\User;
use App\Domain\Reporting\DashboardService;
use App\Domain\Shops\Models\Shop;
use App\Http\Controllers\Controller;
use App\Support\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Tableau de bord (M13) : une boutique, ou toutes les boutiques pour le propriétaire (§3.6). */
class DashboardController extends Controller
{
    public function __construct(private DashboardService $dashboard) {}

    public function shop(Request $request, Shop $shop): JsonResponse
    {
        return response()->json(['data' => $this->dashboard->build($request->user(), [$shop->id], (string) $request->query('period', 'today'))]);
    }

    /** « Toutes mes boutiques » : réservé au propriétaire. */
    public function all(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if (! $user->isOwner()) {
            throw ApiException::forbidden("Vous n'avez pas accès à cette vue.");
        }
        $shops = Shop::query()->where('is_active', true)->pluck('id')->all();

        return response()->json(['data' => $this->dashboard->build($user, $shops, (string) $request->query('period', 'today'))]);
    }
}
