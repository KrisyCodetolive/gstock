<?php

namespace Database\Seeders;

use App\Domain\Platform\Models\PlatformAdmin;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(PlanSeeder::class);
        // Données de démonstration : jamais en production.
        if (! app()->isProduction()) {
            $this->call([DemoTenantSeeder::class, DemoCatalogSeeder::class, DemoSalesSeeder::class, DemoPurchasesSeeder::class]);
            // Compte du back-office de démonstration (admin@gstock.app / demo1234).
            PlatformAdmin::query()->updateOrCreate(['email' => 'admin@gstock.app'], ['name' => 'Équipe GStock', 'password' => DemoTenantSeeder::PASSWORD, 'is_active' => true]);
        }
    }
}
