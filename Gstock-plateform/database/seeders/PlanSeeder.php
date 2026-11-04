<?php

namespace Database\Seeders;

use App\Domain\Platform\Models\Plan;
use Illuminate\Database\Seeder;

/** Offres d'abonnement, en attendant la décision de l'équipe produit (P7 : hypothèse). */
class PlanSeeder extends Seeder
{
    public function run(): void
    {
        foreach ([
            ['name' => 'Essentiel', 'description' => 'Une boutique, pour démarrer.', 'price' => 5000, 'max_shops' => 1, 'max_users' => 3, 'max_products' => 300, 'is_recommended' => false],
            ['name' => 'Commerce', 'description' => 'Plusieurs boutiques et une équipe.', 'price' => 12000, 'max_shops' => 3, 'max_users' => 10, 'max_products' => 2000, 'is_recommended' => true],
            ['name' => 'Réseau', 'description' => 'Pour les commerces qui grandissent.', 'price' => 25000, 'max_shops' => 10, 'max_users' => 30, 'max_products' => 10000, 'is_recommended' => false],
        ] as $plan) {
            Plan::query()->updateOrCreate(['name' => $plan['name']], [...$plan, 'billing_period' => 'monthly', 'trial_days' => 14]);
        }
    }
}
