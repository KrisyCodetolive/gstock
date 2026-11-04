<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Clients (M10), ventes et paiements (M08), crédits clients (M09, §8.5, §8.6).
 * Une vente validée, un paiement, un crédit ne se suppriment jamais : ils
 * s'annulent avec un motif (ADR-012).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('phone', 20)->nullable();
            $table->string('district')->nullable();
            $table->string('note')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['tenant_id', 'phone']);
            $table->index(['tenant_id', 'name']);
        });

        Schema::table('shops', function (Blueprint $table) {
            $table->foreign('default_customer_id')->references('id')->on('customers')->nullOnDelete();
        });

        Schema::create('sales', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('shop_id')->constrained();
            $table->string('reference', 32);
            $table->uuid('offline_uuid')->nullable();
            $table->timestamp('occurred_at');
            $table->foreignId('customer_id')->nullable()->constrained();
            $table->foreignId('user_id')->constrained();
            $table->decimal('subtotal', 15, 2);
            $table->decimal('discount', 15, 2)->default(0);
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->decimal('total', 15, 2);
            // Payé à la vente (hors rendu) ; reste mis à crédit (§7.5).
            $table->decimal('paid_now', 15, 2);
            $table->decimal('credit_amount', 15, 2);
            // paid, partial, credit.
            $table->string('payment_status', 16);
            // completed, cancelled.
            $table->string('status', 16)->default('completed');
            // Vente synchronisée avec un écart : à vérifier (ADR-005, P2).
            $table->string('sync_status', 16)->default('ok');
            $table->jsonb('review_reasons')->nullable();
            $table->string('note')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users');
            $table->string('cancel_reason')->nullable();
            $table->timestamps();
            $table->unique(['tenant_id', 'reference']);
            $table->unique(['tenant_id', 'offline_uuid']);
            $table->index(['shop_id', 'occurred_at']);
        });

        Schema::create('sale_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained();
            $table->foreignId('product_variant_id')->nullable()->constrained();
            $table->foreignId('unit_id')->nullable()->constrained();
            $table->decimal('quantity', 15, 3);
            // Quantité sortie du stock, en unité de base.
            $table->decimal('base_quantity', 15, 3);
            $table->decimal('price', 15, 2);
            // Coût d'achat au moment de la vente (résultat estimé, §7.8).
            $table->decimal('unit_cost', 15, 2)->nullable();
            $table->decimal('discount', 15, 2)->default(0);
            $table->string('discount_method', 16)->nullable();
            $table->decimal('discount_amount', 15, 2)->default(0);
            $table->decimal('tax_rate', 5, 2)->nullable();
            $table->string('tax_method', 16)->default('exclusive');
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->decimal('subtotal', 15, 2);
        });

        Schema::create('sale_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained()->cascadeOnDelete();
            // Null : payé avec l'avoir du client (décision P3).
            $table->foreignId('payment_method_id')->nullable()->constrained();
            $table->decimal('amount', 15, 2);
            // Espèces : somme donnée et rendu (jamais compté comme argent reçu).
            $table->decimal('cash_given', 15, 2)->nullable();
            $table->decimal('change', 15, 2)->nullable();
            $table->string('geniuspay_transaction_id')->nullable();
            // pending (GeniusPay, jusqu'au webhook), completed, failed, cancelled.
            $table->string('status', 16)->default('completed');
            $table->timestamps();
        });

        Schema::create('customer_credits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('shop_id')->constrained();
            $table->foreignId('customer_id')->constrained();
            // Vide pour une ancienne dette saisie à la mise en place (solde initial).
            $table->foreignId('sale_id')->nullable()->constrained();
            $table->string('reference', 32);
            $table->timestamp('occurred_at');
            $table->decimal('amount', 15, 2);
            $table->decimal('remaining_amount', 15, 2);
            $table->boolean('is_opening_balance')->default(false);
            // open, partial, settled, cancelled.
            $table->string('status', 16)->default('open');
            $table->foreignId('user_id')->constrained();
            $table->string('note')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users');
            $table->string('cancel_reason')->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'customer_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_credits');
        Schema::dropIfExists('sale_payments');
        Schema::dropIfExists('sale_items');
        Schema::dropIfExists('sales');
        Schema::table('shops', fn (Blueprint $table) => $table->dropForeign(['default_customer_id']));
        Schema::dropIfExists('customers');
    }
};
