<?php

use App\Http\Controllers\Api\V1\AdjustmentController;
use App\Http\Controllers\Api\V1\AuditLogController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CentralLoginController;
use App\Http\Controllers\Api\V1\CreditController;
use App\Http\Controllers\Api\V1\CustomerController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\ExpenseController;
use App\Http\Controllers\Api\V1\GeniusPayWebhookController;
use App\Http\Controllers\Api\V1\MeController;
use App\Http\Controllers\Api\V1\OnboardingController;
use App\Http\Controllers\Api\V1\ProductController;
use App\Http\Controllers\Api\V1\PublicReceiptController;
use App\Http\Controllers\Api\V1\PurchaseController;
use App\Http\Controllers\Api\V1\Referentials\BrandController;
use App\Http\Controllers\Api\V1\Referentials\CategoryController;
use App\Http\Controllers\Api\V1\Referentials\ExpenseCategoryController;
use App\Http\Controllers\Api\V1\Referentials\PaymentMethodController;
use App\Http\Controllers\Api\V1\Referentials\UnitController;
use App\Http\Controllers\Api\V1\RegistrationController;
use App\Http\Controllers\Api\V1\RepaymentController;
use App\Http\Controllers\Api\V1\RoleController;
use App\Http\Controllers\Api\V1\SaleController;
use App\Http\Controllers\Api\V1\SettingsController;
use App\Http\Controllers\Api\V1\ShopController;
use App\Http\Controllers\Api\V1\StockController;
use App\Http\Controllers\Api\V1\SubscriptionController;
use App\Http\Controllers\Api\V1\SupplierController;
use App\Http\Controllers\Api\V1\SyncController;
use App\Http\Controllers\Api\V1\UserController;
use App\Http\Controllers\GeniusPaySimulationController;
use Illuminate\Support\Facades\Route;

/*
 * API REST de l'application commerçant (§9), préfixe /api/v1.
 * L'espace est identifié par le sous-domaine (ADR-009), jamais par un paramètre.
 * Permissions contrôlées sur chaque endpoint (§6.2) ; espace suspendu en lecture seule (M00).
 */
// Domaine principal (M00) : formules et inscription, sans session ni espace.
Route::get('plans', [RegistrationController::class, 'plans']);
Route::get('register/check-slug', [RegistrationController::class, 'checkSlug'])->middleware('throttle:60,1');
Route::post('register', [RegistrationController::class, 'register'])->middleware('throttle:10,1');
// Connexion sur le domaine principal : trouve l'espace de la personne et l'y envoie déjà connectée (ADR-009).
Route::post('auth/central-login', [CentralLoginController::class, 'login'])->middleware('throttle:auth');

// Webhook GeniusPay des abonnements (ADR-003) : authentifié par sa signature.
Route::post('webhooks/geniuspay/platform', [GeniusPayWebhookController::class, 'platform'])->middleware('throttle:120,1');

// Page de paiement simulée (pilote « simulation », jamais en production) : liens signés.
Route::get('simulation/geniuspay/{invoice}', [GeniusPaySimulationController::class, 'show'])->name('geniuspay.simulation');
Route::get('simulation/geniuspay/{invoice}/pay', [GeniusPaySimulationController::class, 'pay'])->name('geniuspay.simulation.pay');

Route::middleware('tenant')->group(function () {
    // Reçu partagé par WhatsApp : public, lien signé et expirant (ADR-013).
    Route::get('public/receipts/{token}', [PublicReceiptController::class, 'show'])->middleware('throttle:60,1');

    Route::prefix('auth')->middleware('throttle:auth')->group(function () {
        Route::post('login', [AuthController::class, 'login']);
        Route::post('logout', [AuthController::class, 'logout']);
        Route::post('token-login', [AuthController::class, 'tokenLogin']);
        Route::post('forgot-password', [AuthController::class, 'forgotPassword']);
        Route::post('reset-password', [AuthController::class, 'resetPassword']);
    });

    // Permis même quand l'espace est suspendu : payer l'abonnement, l'assistant de démarrage.
    Route::middleware(['auth:sanctum', 'active'])->group(function () {
        Route::post('subscription/checkout', [SubscriptionController::class, 'checkout'])->middleware('permission:subscription.manage');
        Route::post('onboarding/steps/{step}/skip', [OnboardingController::class, 'skip']);
        Route::post('onboarding/dismiss', [OnboardingController::class, 'dismiss']);
    });

    Route::middleware(['auth:sanctum', 'active', 'writable'])->group(function () {
        // Mon abonnement (M00).
        Route::middleware('permission:subscription.manage')->group(function () {
            Route::get('subscription', [SubscriptionController::class, 'show']);
            Route::get('subscription/invoices', [SubscriptionController::class, 'invoices']);
        });
        Route::get('onboarding', [OnboardingController::class, 'show']);

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

        // Tableau de bord de toutes les boutiques (M13) : propriétaire seulement, vérifié dans le contrôleur.
        Route::get('dashboard', [DashboardController::class, 'all'])->middleware('permission:dashboard.view');

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

        // Mes produits (M06) : catalogue commun à l'espace.
        Route::get('products', [ProductController::class, 'index'])->middleware('permission:products.view');
        Route::post('products', [ProductController::class, 'store'])->middleware('permission:products.create');
        Route::get('products/{product}', [ProductController::class, 'show'])->middleware('permission:products.view');
        // Désactiver demande products.disable, modifier products.update : vérifié dans le service.
        Route::put('products/{product}', [ProductController::class, 'update'])->middleware('permission:products.update,products.disable');
        Route::post('products/{product}/image', [ProductController::class, 'uploadImage'])->middleware('permission:products.update,products.create');
        Route::delete('products/{product}/image', [ProductController::class, 'deleteImage'])->middleware('permission:products.update');
        Route::get('products/{product}/stock', [ProductController::class, 'stock'])->middleware('permission:products.view');
        // Mes clients (M10) : communs à l'espace ; la caisse peut les lire et en créer.
        Route::get('customers', [CustomerController::class, 'index'])->middleware('permission:customers.view,sales.create');
        Route::get('customers/{customer}', [CustomerController::class, 'show'])->middleware('permission:customers.view,sales.create');
        Route::get('customers/{customer}/summary', [CustomerController::class, 'summary'])->middleware('permission:customers.view');
        Route::post('customers', [CustomerController::class, 'store'])->middleware('permission:customers.create');
        Route::put('customers/{customer}', [CustomerController::class, 'update'])->middleware('permission:customers.update');
        // Fiche crédit d'un client, sur les boutiques accessibles (M09).
        Route::get('customers/{customer}/credits', [CreditController::class, 'customerFile'])->middleware('permission:credits.view');

        // Fournisseurs (M11) : communs à l'espace ; l'écran d'approvisionnement peut les lire.
        Route::get('suppliers', [SupplierController::class, 'index'])->middleware('permission:suppliers.view,purchases.create');
        Route::get('suppliers/{supplier}', [SupplierController::class, 'show'])->middleware('permission:suppliers.view');
        Route::post('suppliers', [SupplierController::class, 'store'])->middleware('permission:suppliers.manage');
        Route::put('suppliers/{supplier}', [SupplierController::class, 'update'])->middleware('permission:suppliers.manage');

        // Mon stock, vue « Toutes mes boutiques » (M07).
        Route::get('stock', [StockController::class, 'overview'])->middleware('permission:stock.view');

        // Ressources de boutique : affectation vérifiée sur chaque requête (§6.2).
        Route::prefix('shops/{shop}')->middleware('shop')->group(function () {
            Route::get('products/search', [ProductController::class, 'search']);
            Route::get('dashboard', [DashboardController::class, 'shop'])->middleware('permission:dashboard.view');
            // Opérations faites hors ligne (ADR-005) : le droit de chaque opération est vérifié une à une.
            Route::post('sync', [SyncController::class, 'store'])->middleware(['permission:sales.create,repayments.create,expenses.create', 'throttle:60,1']);
            Route::middleware('permission:stock.view')->group(function () {
                Route::get('stock', [StockController::class, 'index']);
                Route::get('stock/alerts', [StockController::class, 'alerts']);
                Route::get('stock/movements', [StockController::class, 'movements']);
                Route::get('adjustments/{id}', [AdjustmentController::class, 'show'])->whereNumber('id');
            });
            // Le type de mouvement (entrée, sortie, inventaire) demande sa propre permission : vérifié dans le service.
            Route::post('adjustments', [AdjustmentController::class, 'store'])->middleware('permission:stock.entry,stock.exit,stock.adjust');
            Route::post('adjustments/{id}/cancel', [AdjustmentController::class, 'cancel'])->middleware('permission:stock.adjust')->whereNumber('id');

            // Caisse et ventes (M08).
            Route::middleware('permission:sales.create')->group(function () {
                Route::get('pos/bootstrap', [SaleController::class, 'bootstrap']);
                Route::post('sales/quote', [SaleController::class, 'quote']);
                Route::post('sales', [SaleController::class, 'store']);
            });
            Route::get('sales', [SaleController::class, 'index'])->middleware('permission:sales.view');
            Route::middleware('permission:sales.view,sales.create')->group(function () {
                Route::get('sales/{id}', [SaleController::class, 'show'])->whereNumber('id');
                Route::get('sales/{id}/receipt', [SaleController::class, 'receipt'])->whereNumber('id');
                Route::post('sales/{id}/share-link', [SaleController::class, 'shareLink'])->whereNumber('id');
            });
            Route::post('sales/{id}/cancel', [SaleController::class, 'cancel'])->middleware('permission:sales.cancel')->whereNumber('id');

            // Mes crédits clients (M09).
            Route::middleware('permission:credits.view')->group(function () {
                Route::get('credits/summary', [CreditController::class, 'summary']);
                Route::get('credits/debtors', [CreditController::class, 'debtors']);
                Route::get('credits', [CreditController::class, 'index']);
                Route::get('credits/{id}/installments', [CreditController::class, 'installments'])->whereNumber('id');
                Route::get('installments', [CreditController::class, 'allInstallments']);
            });
            Route::post('credits/opening-balance', [CreditController::class, 'openingBalance'])->middleware('permission:credits.opening_balance');
            Route::post('credits/{id}/cancel', [CreditController::class, 'cancel'])->middleware('permission:credits.cancel')->whereNumber('id');
            Route::post('credits/{id}/adjustments', [CreditController::class, 'adjust'])->middleware('permission:credits.cancel')->whereNumber('id');
            Route::put('credits/{id}/installments', [CreditController::class, 'setInstallments'])->middleware('permission:credits.create')->whereNumber('id');

            Route::post('repayments', [RepaymentController::class, 'store'])->middleware('permission:repayments.create');
            Route::middleware('permission:credits.view,repayments.create')->group(function () {
                Route::get('repayments', [RepaymentController::class, 'index']);
                Route::get('repayments/{id}', [RepaymentController::class, 'show'])->whereNumber('id');
                Route::get('repayments/{id}/receipt', [RepaymentController::class, 'receipt'])->whereNumber('id');
                Route::post('repayments/{id}/share-link', [RepaymentController::class, 'shareLink'])->whereNumber('id');
            });
            Route::post('repayments/{id}/cancel', [RepaymentController::class, 'cancel'])->middleware('permission:repayments.cancel')->whereNumber('id');

            // Approvisionnements (M11).
            Route::middleware('permission:purchases.create')->group(function () {
                Route::post('purchases/quote', [PurchaseController::class, 'quote']);
                Route::post('purchases', [PurchaseController::class, 'store']);
            });
            Route::middleware('permission:purchases.view')->group(function () {
                Route::get('purchases', [PurchaseController::class, 'index']);
                Route::get('purchases/{id}', [PurchaseController::class, 'show'])->whereNumber('id');
            });
            // Échéancier du reste dû : même droit que pour payer le fournisseur.
            Route::middleware('permission:purchase_payments.create')->group(function () {
                Route::post('purchases/{id}/payments', [PurchaseController::class, 'addPayment'])->whereNumber('id');
                Route::put('purchases/{id}/installments', [PurchaseController::class, 'setInstallments'])->whereNumber('id');
            });
            Route::post('purchases/{id}/cancel', [PurchaseController::class, 'cancel'])->middleware('permission:purchases.cancel')->whereNumber('id');

            // Dépenses (M12).
            Route::get('expenses', [ExpenseController::class, 'index'])->middleware('permission:expenses.view');
            Route::post('expenses', [ExpenseController::class, 'store'])->middleware('permission:expenses.create');
            Route::post('expenses/{id}/cancel', [ExpenseController::class, 'cancel'])->middleware('permission:expenses.cancel')->whereNumber('id');
        });
    });
});
