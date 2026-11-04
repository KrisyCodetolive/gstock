<?php

use App\Http\Middleware\EnsureTenantIsWritable;
use App\Http\Middleware\EnsureUserIsActive;
use App\Http\Middleware\RequirePermission;
use App\Http\Middleware\RequireShopAccess;
use App\Support\ApiException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Stancl\Tenancy\Contracts\TenantCouldNotBeIdentifiedException;
use Stancl\Tenancy\Exceptions\NotASubdomainException;
use Stancl\Tenancy\Middleware\InitializeTenancyBySubdomain;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        apiPrefix: 'api/v1',
        commands: __DIR__.'/../routes/console.php',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Application commerçant : session Sanctum par cookie (ADR-008).
        $middleware->statefulApi();
        $middleware->alias([
            'tenant' => InitializeTenancyBySubdomain::class,
            'permission' => RequirePermission::class,
            'active' => EnsureUserIsActive::class,
            'writable' => EnsureTenantIsWritable::class,
            'shop' => RequireShopAccess::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Toutes les erreurs de l'API au format {message, errors} et en français (§9).
        $api = fn (Request $request) => $request->is('api/*') || $request->expectsJson();

        $exceptions->render(fn (ApiException $e) => response()->json($e->body(), $e->status));

        $exceptions->render(function (ValidationException $e, Request $request) use ($api) {
            if ($api($request)) {
                return response()->json(['message' => 'Les informations saisies ne sont pas valides.', 'errors' => $e->errors()], 422);
            }
        });

        $exceptions->render(function (AuthenticationException $e, Request $request) use ($api) {
            if ($api($request)) {
                // Message propre au cas (fin du mode support), sinon le message habituel.
                $message = $e->getMessage() !== 'Unauthenticated.' ? $e->getMessage() : 'Votre session a expiré. Reconnectez-vous.';

                return response()->json(['message' => $message], 401);
            }
        });

        $exceptions->render(function (AuthorizationException|AccessDeniedHttpException $e, Request $request) use ($api) {
            if ($api($request)) {
                return response()->json(['message' => "Vous n'avez pas accès à cette action."], 403);
            }
        });

        $exceptions->render(function (ModelNotFoundException|NotFoundHttpException $e, Request $request) use ($api) {
            if ($api($request)) {
                return response()->json(['message' => "Cet élément n'existe pas ou a été retiré."], 404);
            }
        });

        $exceptions->render(function (TenantCouldNotBeIdentifiedException|NotASubdomainException $e) {
            return response()->json(['message' => "Cet espace n'existe pas. Vérifiez l'adresse."], 404);
        });

        $exceptions->render(function (ThrottleRequestsException $e, Request $request) use ($api) {
            if ($api($request)) {
                return response()->json(['message' => 'Trop de tentatives. Patientez une minute avant de réessayer.'], 429, $e->getHeaders());
            }
        });

        $exceptions->render(function (HttpExceptionInterface $e, Request $request) use ($api) {
            if ($api($request) && $e->getStatusCode() === 419) {
                return response()->json(['message' => 'Votre session a expiré. Rechargez la page.'], 419);
            }
        });
    })->create();
