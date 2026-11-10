<?php

namespace App\Providers;

use App\Domain\Platform\Billing\GeniusPayPlatformGateway;
use App\Domain\Platform\Billing\PlatformGateway;
use App\Domain\Platform\Billing\SimulatedPlatformGateway;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use RuntimeException;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Paiement des abonnements (ADR-003) : la simulation n'est jamais permise en production.
        $this->app->bind(PlatformGateway::class, function () {
            $driver = config('gstock.geniuspay.platform.driver');
            if ($driver === 'geniuspay') {
                return GeniusPayPlatformGateway::fromConfig();
            }
            if ($driver === 'simulation' && ! $this->app->isProduction()) {
                return new SimulatedPlatformGateway;
            }

            throw new RuntimeException("Le pilote GeniusPay « {$driver} » n'est pas disponible : configurez GENIUSPAY_PLATFORM_DRIVER.");
        });
    }

    public function boot(): void
    {
        // Connexion et réinitialisation : 10 essais par minute et par adresse IP (§12.2).
        RateLimiter::for('auth', fn (Request $request) => Limit::perMinute(10)->by($request->ip().'|'.$request->getHost()));
    }
}
