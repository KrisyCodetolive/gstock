<?php

namespace App\Providers\Filament;

use App\Filament\Widgets\PlatformStats;
use App\Filament\Widgets\SalesByTenant;
use Filament\Http\Middleware\Authenticate;
use Filament\Http\Middleware\AuthenticateSession;
use Filament\Http\Middleware\DisableBladeIconComponents;
use Filament\Http\Middleware\DispatchServingFilamentEvent;
use Filament\Pages\Dashboard;
use Filament\Panel;
use Filament\PanelProvider;
use Filament\Support\Colors\Color;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\View\Middleware\ShareErrorsFromSession;

/**
 * Back-office de Genius Groups (M01, ADR-010) : panneau Filament sur le domaine
 * central (`admin.gstock.app` en production, `/admin` en développement), avec
 * une authentification séparée (garde `platform`, table `platform_admins`).
 */
class AdminPanelProvider extends PanelProvider
{
    public function panel(Panel $panel): Panel
    {
        $panel = $panel
            ->default()
            ->id('admin')
            ->path(config('gstock.admin.path'))
            ->authGuard('platform')
            ->login()
            ->brandName('GStock — Back-office')
            ->colors(['primary' => Color::Indigo, 'warning' => Color::Orange])
            ->discoverResources(in: app_path('Filament/Resources'), for: 'App\Filament\Resources')
            ->discoverPages(in: app_path('Filament/Pages'), for: 'App\Filament\Pages')
            ->pages([Dashboard::class])
            ->widgets([PlatformStats::class, SalesByTenant::class])
            ->middleware([
                EncryptCookies::class,
                AddQueuedCookiesToResponse::class,
                StartSession::class,
                AuthenticateSession::class,
                ShareErrorsFromSession::class,
                VerifyCsrfToken::class,
                SubstituteBindings::class,
                DisableBladeIconComponents::class,
                DispatchServingFilamentEvent::class,
            ])
            ->authMiddleware([Authenticate::class]);

        // En production, le panneau n'est servi que sur son domaine.
        if ($domain = config('gstock.admin.domain')) {
            $panel->domain($domain);
        }

        return $panel;
    }
}
