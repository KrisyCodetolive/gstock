<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Shops\Models\Shop;
use App\Domain\Sync\SyncService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Synchronisation hors ligne (ADR-005) : un résultat par opération, dans l'ordre d'envoi. */
class SyncController extends Controller
{
    public function store(Request $request, Shop $shop, SyncService $sync): JsonResponse
    {
        return response()->json(['data' => $sync->process($shop, $request->user(), (array) $request->input('operations', []))]);
    }
}
