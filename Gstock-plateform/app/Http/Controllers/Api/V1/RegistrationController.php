<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Platform\Billing\SubscriptionService;
use App\Domain\Platform\Models\Plan;
use App\Domain\Platform\Registration\RegistrationService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Domaine principal (M00) : formules, vérification de l'adresse, inscription. Sans session. */
class RegistrationController extends Controller
{
    public function __construct(private RegistrationService $registration) {}

    public function plans(): JsonResponse
    {
        return response()->json(['data' => Plan::query()->where('is_active', true)->orderBy('price')->get()->map(SubscriptionService::plan(...))]);
    }

    public function checkSlug(Request $request): JsonResponse
    {
        $slug = mb_strtolower(trim((string) $request->query('slug', '')));
        $message = $this->registration->slugProblem($slug);

        return response()->json(['data' => [
            'available' => $message === null,
            'message' => $message,
            'suggestion' => $message ? $this->registration->suggestion($slug) : null,
        ]]);
    }

    public function register(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->registration->register($request->all())], 201);
    }
}
