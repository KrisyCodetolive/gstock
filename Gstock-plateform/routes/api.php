<?php

use App\Http\Controllers\Api\V1\AuditLogController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\MeController;
use App\Http\Controllers\Api\V1\Referentials\BrandController;
use App\Http\Controllers\Api\V1\Referentials\CategoryController;
use App\Http\Controllers\Api\V1\Referentials\ExpenseCategoryController;
use App\Http\Controllers\Api\V1\Referentials\PaymentMethodController;
use App\Http\Controllers\Api\V1\Referentials\UnitController;
use App\Http\Controllers\Api\V1\RoleController;
use App\Http\Controllers\Api\V1\SettingsController;
use App\Http\Controllers\Api\V1\ShopController;
use App\Http\Controllers\Api\V1\UserController;
use Illuminate\Support\Facades\Route;

/*
 * API REST de l'application commerçant (§9), préfixe /api/v1.
 * L'espace est identifié par le sous-domaine (ADR-009), jamais par un paramètre.
 * Permissions contrôlées sur chaque endpoint (§6.2) ; espace suspendu en lecture seule (M00).
 */
Route::middleware('tenant')->group(function () {
    Route::prefix('auth')->middleware('throttle:auth')->group(function () {
        Route::post('login', [AuthController::class, 'login']);
        Route::post('logout', [AuthController::class, 'logout']);
        Route::post('forgot-password', [AuthController::class, 'forgotPassword']);
        Route::post('reset-password', [AuthController::class, 'resetPassword']);
    });

    Route::middleware(['auth:sanctum', 'active', 'writable'])->group(function () {
        Route::get('me', [MeController::class, 'show']);
        Route::put('me', [MeController::class, 'update']);
        Route::put('me/password', [MeController::class, 'password']);
        Route::post('me/avatar', [MeController::class, 'uploadAvatar']);
        Route::delete('me/avatar', [MeController::class, 'deleteAvatar']);

        Route::middleware('permission:settings.manage')->group(function () {
            Route::get('settings', [SettingsController::class, 'show']);
            Route::put('settings', [SettingsController::class, 'update']);
        });
        Route::middleware('permission:payment_settings.manage')->group(function () {
            Route::get('settings/payment', [SettingsController::class, 'showPayment']);
            Route::put('settings/payment', [SettingsController::class, 'updatePayment']);
            Route::post('settings/payment/test', [SettingsController::class, 'testPayment']);
        });

        Route::get('shops', [ShopController::class, 'index'])->middleware('permission:shops.manage,users.manage');
        Route::middleware('permission:shops.manage')->group(function () {
            Route::get('shops/{shop}', [ShopController::class, 'show']);
            Route::post('shops', [ShopController::class, 'store']);
            Route::put('shops/{shop}', [ShopController::class, 'update']);
        });

        Route::get('permissions', [RoleController::class, 'permissions'])->middleware('permission:roles.manage');
        Route::get('roles', [RoleController::class, 'index'])->middleware('permission:roles.manage,users.manage');
        Route::middleware('permission:roles.manage')->group(function () {
            Route::get('roles/{role}', [RoleController::class, 'show']);
            Route::post('roles', [RoleController::class, 'store']);
            Route::put('roles/{role}', [RoleController::class, 'update']);
            Route::delete('roles/{role}', [RoleController::class, 'destroy']);
        });

        Route::get('users', [UserController::class, 'index'])->middleware('permission:users.manage,shops.manage');
        Route::middleware('permission:users.manage')->group(function () {
            Route::get('users/{user}', [UserController::class, 'show']);
            Route::post('users', [UserController::class, 'store']);
            Route::put('users/{user}', [UserController::class, 'update']);
            Route::patch('users/{user}/status', [UserController::class, 'status']);
            Route::put('users/{user}/shops', [UserController::class, 'shops']);
        });

        Route::get('audit-logs', [AuditLogController::class, 'index'])->middleware('permission:audit.view');

        // Référentiels (M05) : lecture pour les écrans qui en ont besoin, écriture pour qui les gère. Pas de suppression.
        foreach ([
            'categories' => [CategoryController::class, 'products.view,categories.manage', 'categories.manage'],
            'units' => [UnitController::class, 'products.view,units.manage', 'units.manage'],
            'payment-methods' => [PaymentMethodController::class, 'sales.create,repayments.create,expenses.create,settings.manage', 'settings.manage'],
            'expense-categories' => [ExpenseCategoryController::class, 'expenses.view,settings.manage', 'settings.manage'],
            'brands' => [BrandController::class, 'products.view,settings.manage', 'settings.manage'],
        ] as $path => [$controller, $read, $write]) {
            Route::get($path, [$controller, 'index'])->middleware("permission:{$read}");
            Route::post($path, [$controller, 'store'])->middleware("permission:{$write}");
            Route::put("{$path}/{id}", [$controller, 'update'])->middleware("permission:{$write}")->whereNumber('id');
        }
    });
});
