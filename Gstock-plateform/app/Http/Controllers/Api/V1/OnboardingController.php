<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Identity\Models\User;
use App\Domain\Platform\CurrentTenant;
use App\Domain\Platform\OnboardingService;
use App\Http\Controllers\Controller;
use App\Support\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Assistant de démarrage (M00) : propriétaire seulement. */
class OnboardingController extends Controller
{
    public function __construct(private OnboardingService $onboarding) {}

    public function show(Request $request): JsonResponse
    {
        $this->owner($request);

        return response()->json(['data' => $this->onboarding->state(CurrentTenant::get())]);
    }

    public function skip(Request $request, string $step): JsonResponse
    {
        $this->owner($request);

        return response()->json(['data' => $this->onboarding->skip(CurrentTenant::get(), $step)]);
    }

    public function dismiss(Request $request): JsonResponse
    {
        $this->owner($request);

        return response()->json(['data' => $this->onboarding->dismiss(CurrentTenant::get())]);
    }

    private function owner(Request $request): void
    {
        /** @var User $user */
        $user = $request->user();
        if (! $user->isOwner()) {
            throw ApiException::forbidden();
        }
    }
}
