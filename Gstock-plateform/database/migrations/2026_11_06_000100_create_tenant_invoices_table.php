<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Factures d'abonnement (§8.1, M00) : table de la plateforme, sans `tenant_id`
 * filtré par espace. Une facture est créée « en attente » au lancement du paiement
 * et n'est validée qu'au webhook GeniusPay (ADR-003).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tenant_invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tenant_subscription_id')->constrained()->cascadeOnDelete();
            // Formule payée : elle devient celle de l'abonnement au paiement.
            $table->foreignId('plan_id')->constrained();
            $table->string('reference', 32)->unique();
            $table->decimal('amount', 15, 2);
            // pending, paid, failed.
            $table->string('status', 16)->default('pending');
            // Moyen choisi sur la page GeniusPay (Wave, Orange Money…), connu au webhook.
            $table->string('payment_channel', 64)->nullable();
            $table->string('geniuspay_transaction_id')->nullable()->unique();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tenant_invoices');
    }
};
