<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Plateforme SaaS (§8.1) : tables sans `tenant_id`, réservées au back-office.
 * Un espace (tenant) est identifié par son sous-domaine (table `domains`, ADR-009).
 */
return new class extends Migration
{
    public function up(): void
    {
        // Recherche sans tenir compte des accents (« eleve » trouve « Élève »).
        DB::statement('CREATE EXTENSION IF NOT EXISTS unaccent');

        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('description')->default('');
            $table->decimal('price', 15, 2);
            $table->string('billing_period')->default('monthly');
            $table->unsignedInteger('max_shops');
            $table->unsignedInteger('max_users');
            $table->unsignedInteger('max_products');
            $table->unsignedInteger('trial_days')->default(14);
            $table->boolean('is_recommended')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('tenants', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('owner_email')->nullable();
            $table->string('phone')->nullable();
            $table->string('currency_code', 3)->default('XOF');
            $table->string('timezone')->default('Africa/Abidjan');
            // trial, active, suspended, cancelled (fermé par Genius Groups : plus de connexion).
            $table->string('status')->default('trial');
            $table->timestamp('activated_at')->nullable();
            $table->timestamp('first_sale_at')->nullable();
            $table->json('data')->nullable();
            $table->timestamps();
        });

        Schema::create('domains', function (Blueprint $table) {
            $table->id();
            // Sous-domaine seul (« alimentation-kone »), le domaine central est dans la configuration.
            $table->string('domain')->unique();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
        });

        Schema::create('tenant_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('plan_id')->constrained();
            $table->timestamp('starts_at');
            $table->timestamp('trial_ends_at')->nullable();
            // Fin de la période payée.
            $table->timestamp('ends_at')->nullable();
            $table->string('status')->default('trial');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tenant_subscriptions');
        Schema::dropIfExists('domains');
        Schema::dropIfExists('tenants');
        Schema::dropIfExists('plans');
    }
};
