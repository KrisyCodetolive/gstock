<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Espace et boutiques (§8.2, ADR-011) : paramètres de l'espace, clés GeniusPay
 * chiffrées, boutiques et affectations des utilisateurs, séquences de références.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tenant_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('logo_path')->nullable();
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->string('address')->nullable();
            $table->string('receipt_footer')->nullable();
            // Variantes, taxes, unités multiples, marques : masqués si faux (§3.1).
            $table->boolean('advanced_mode')->default(false);
            $table->unsignedBigInteger('default_payment_method_id')->nullable();
            $table->timestamps();
        });

        Schema::create('tenant_payment_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('provider')->default('geniuspay');
            // Chiffrées par l'application (cast « encrypted »), jamais renvoyées en clair.
            $table->text('api_key')->nullable();
            $table->text('api_secret')->nullable();
            $table->text('webhook_secret')->nullable();
            $table->boolean('is_sandbox')->default(true);
            $table->boolean('is_active')->default(false);
            $table->timestamps();
        });

        Schema::create('shops', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('city');
            $table->string('district')->nullable();
            $table->string('address')->nullable();
            $table->string('phone')->nullable();
            $table->string('receipt_note')->nullable();
            $table->boolean('receipt_show_customer')->default(true);
            $table->boolean('receipt_show_phone')->default(true);
            $table->boolean('auto_print_receipt')->default(false);
            // Clé étrangère ajoutée avec la table des clients.
            $table->unsignedBigInteger('default_customer_id')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['tenant_id', 'name']);
        });

        Schema::create('shop_user', function (Blueprint $table) {
            $table->foreignId('shop_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->primary(['shop_id', 'user_id']);
        });

        // Références PRÉFIXE-N numérotées par espace (V-, CR-, RB-, AP-, MS-, DP-), ligne verrouillée en transaction.
        Schema::create('document_sequences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('document_type', 8);
            $table->unsignedBigInteger('next_number')->default(1);
            $table->timestamps();
            $table->unique(['tenant_id', 'document_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_sequences');
        Schema::dropIfExists('shop_user');
        Schema::dropIfExists('shops');
        Schema::dropIfExists('tenant_payment_settings');
        Schema::dropIfExists('tenant_settings');
    }
};
