<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Données de départ : les formules d'abonnement seulement. Aucun compte n'est créé :
 * un espace s'ouvre par l'inscription (/inscription), un administrateur du back-office
 * par `php artisan gstock:admin`.
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(PlanSeeder::class);
    }
}
