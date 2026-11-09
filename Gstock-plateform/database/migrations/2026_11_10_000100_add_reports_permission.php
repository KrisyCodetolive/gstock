<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Rapports, première partie (M15) : nouvelle permission `reports.view`,
 * accordée au seul rôle Owner (il reçoit toutes les permissions, ADR-014).
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('permissions')->insert([
            'name' => 'reports.view', 'label' => 'Voir les rapports (ventes, produits, à racheter, dormants)', 'group' => 'general', 'level' => 'shop',
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('permissions')->where('name', 'reports.view')->delete();
    }
};
