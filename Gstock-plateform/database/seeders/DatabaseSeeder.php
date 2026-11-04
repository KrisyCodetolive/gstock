<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(PlanSeeder::class);
        // Données de démonstration : jamais en production.
        if (! app()->isProduction()) {
            $this->call([DemoTenantSeeder::class, DemoCatalogSeeder::class]);
        }
    }
}
