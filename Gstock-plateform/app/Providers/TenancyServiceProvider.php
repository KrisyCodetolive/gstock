<?php

declare(strict_types=1);

namespace App\Providers;

use Illuminate\Contracts\Http\Kernel;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;
use Stancl\Tenancy\Events;
use Stancl\Tenancy\Listeners;
use Stancl\Tenancy\Middleware;

/**
 * Multi-tenant en base unique (ADR-002) : aucune base n'est créée ni supprimée
 * par espace ; seul le contexte de l'espace est initialisé à chaque requête.
 */
class TenancyServiceProvider extends ServiceProvider
{
    public function events(): array
    {
        return [
            Events\TenancyInitialized::class => [Listeners\BootstrapTenancy::class],
            Events\TenancyEnded::class => [Listeners\RevertToCentralContext::class],
        ];
    }

    public function boot(): void
    {
        foreach ($this->events() as $event => $listeners) {
            foreach ($listeners as $listener) {
                Event::listen($event, $listener);
            }
        }

        // L'espace est identifié avant toute autre chose (session, authentification).
        $kernel = $this->app->make(Kernel::class);
        foreach (array_reverse([
            Middleware\PreventAccessFromCentralDomains::class,
            Middleware\InitializeTenancyBySubdomain::class,
        ]) as $middleware) {
            $kernel->prependToMiddlewarePriority($middleware);
        }
    }
}
