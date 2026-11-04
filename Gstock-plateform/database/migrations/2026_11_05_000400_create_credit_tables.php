<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Crédits clients (M09, §7.6, §7.7, §8.6, décision P3) : paiements RB-N et leurs
 * affectations, régularisations, échéances, avoirs, argent rendu. Rien ne se
 * supprime : on annule avec un motif (ADR-012).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customer_credits', function (Blueprint $table) {
            // Décision P3 appliquée à l'annulation : argent déjà reçu gardé en avoir ou rendu.
            $table->string('cancel_settlement_mode', 16)->nullable();
            $table->decimal('cancel_settlement_amount', 15, 2)->nullable();
        });

        Schema::create('credit_repayments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('shop_id')->constrained();
            $table->foreignId('customer_id')->constrained();
            $table->string('reference', 32);
            $table->uuid('offline_uuid')->nullable();
            $table->timestamp('received_at');
            $table->decimal('amount', 15, 2);
            // Null : payé avec l'avoir du client (ce n'est pas de l'argent reçu, §7.8).
            $table->foreignId('payment_method_id')->nullable()->constrained();
            $table->string('geniuspay_transaction_id')->nullable();
            $table->foreignId('user_id')->constrained();
            $table->string('note')->nullable();
            // pending (GeniusPay, jusqu'au webhook), completed, cancelled.
            $table->string('status', 16)->default('completed');
            $table->timestamp('cancelled_at')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users');
            $table->string('cancel_reason')->nullable();
            $table->timestamps();
            $table->unique(['tenant_id', 'reference']);
            $table->unique(['tenant_id', 'offline_uuid']);
        });

        Schema::create('credit_repayment_allocations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('credit_repayment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('customer_credit_id')->constrained();
            $table->decimal('amount', 15, 2);
        });

        Schema::create('credit_adjustments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('customer_credit_id')->constrained();
            // Positif : diminue le reste (geste commercial). Négatif : l'augmente (erreur de saisie).
            $table->decimal('amount', 15, 2);
            $table->string('reason');
            $table->foreignId('user_id')->constrained();
            $table->timestamp('created_at')->useCurrent();
        });

        // Avoirs : somme que la boutique doit au client, tenue par mouvements signés (+ créé, − utilisé).
        Schema::create('credit_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('shop_id')->constrained();
            $table->foreignId('customer_id')->constrained();
            $table->decimal('amount', 15, 2);
            // credit_cancel, sale_cancel, repayment, repayment_cancel, sale.
            $table->string('source', 24);
            $table->unsignedBigInteger('source_id');
            $table->timestamp('created_at')->useCurrent();
            $table->index(['tenant_id', 'customer_id', 'shop_id']);
        });

        // Argent rendu au client à l'annulation d'un crédit déjà en partie payé (P3) : une sortie d'argent.
        Schema::create('customer_refunds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('shop_id')->constrained();
            $table->foreignId('customer_id')->constrained();
            $table->foreignId('customer_credit_id')->constrained();
            $table->decimal('amount', 15, 2);
            $table->foreignId('payment_method_id')->constrained();
            $table->string('reason');
            $table->foreignId('user_id')->constrained();
            $table->timestamp('created_at')->useCurrent();
        });

        // Échéancier d'un crédit client ou d'une dette fournisseur (§7.7). Leur état est calculé à la lecture.
        Schema::create('installments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            // customer_credit ou purchase.
            $table->string('payable_type', 24);
            $table->unsignedBigInteger('payable_id');
            $table->date('due_date');
            $table->decimal('amount', 15, 2);
            // Échéance déjà soldée, gardée telle quelle quand l'échéancier est refait.
            $table->boolean('frozen')->default(false);
            $table->timestamps();
            $table->index(['payable_type', 'payable_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('installments');
        Schema::dropIfExists('customer_refunds');
        Schema::dropIfExists('credit_notes');
        Schema::dropIfExists('credit_adjustments');
        Schema::dropIfExists('credit_repayment_allocations');
        Schema::dropIfExists('credit_repayments');
        Schema::table('customer_credits', fn (Blueprint $table) => $table->dropColumn(['cancel_settlement_mode', 'cancel_settlement_amount']));
    }
};
