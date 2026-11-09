<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Identity\Models\User;
use App\Domain\Reporting\ReportService;
use App\Domain\Shops\Models\Shop;
use App\Http\Controllers\Controller;
use App\Support\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Rapports, première partie (M15) : une boutique, ou toutes les boutiques pour le propriétaire (§3.6). */
class ReportController extends Controller
{
    public function __construct(private ReportService $reports) {}

    public function shopSales(Request $request, Shop $shop): JsonResponse
    {
        return $this->sales($request, [$shop->id]);
    }

    public function shopProducts(Request $request, Shop $shop): JsonResponse
    {
        return $this->products($request, [$shop->id]);
    }

    public function shopCustomers(Request $request, Shop $shop): JsonResponse
    {
        return $this->customers($request, [$shop->id]);
    }

    public function allCustomers(Request $request): JsonResponse
    {
        return $this->customers($request, $this->allShops($request));
    }

    public function allSales(Request $request): JsonResponse
    {
        return $this->sales($request, $this->allShops($request));
    }

    public function allProducts(Request $request): JsonResponse
    {
        return $this->products($request, $this->allShops($request));
    }

    /** @param  list<int>  $shops */
    private function sales(Request $request, array $shops): JsonResponse
    {
        [$from, $to] = ReportService::period($request->query('from'), $request->query('to'));

        return response()->json(['data' => $this->reports->sales($shops, $from, $to)]);
    }

    /** @param  list<int>  $shops */
    private function products(Request $request, array $shops): JsonResponse
    {
        [$from, $to] = ReportService::period($request->query('from'), $request->query('to'));

        return response()->json(['data' => $this->reports->products($shops, $from, $to, (int) $request->query('dormant_days', '60'))]);
    }

    /** @param  list<int>  $shops */
    private function customers(Request $request, array $shops): JsonResponse
    {
        [$from, $to] = ReportService::period($request->query('from'), $request->query('to'));

        return response()->json(['data' => $this->reports->customers($shops, $from, $to, (int) $request->query('lost_days', '60'))]);
    }

    /** @return list<int> « Toutes mes boutiques » : réservé au propriétaire. */
    private function allShops(Request $request): array
    {
        /** @var User $user */
        $user = $request->user();
        if (! $user->isOwner()) {
            throw ApiException::forbidden("Vous n'avez pas accès à cette vue.");
        }

        return Shop::query()->where('is_active', true)->pluck('id')->all();
    }
}
