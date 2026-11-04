<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Fournisseurs et approvisionnements AP-N (M11), dépenses DP-N (M12), §8.7.
 * Un approvisionnement, un paiement fournisseur ou une dépense ne se suppriment
 * jamais : ils s'annulent avec un motif (ADR-012). L'échéancier d'une dette
 * fournisseur est dans `installments` (payable_type = purchase).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('suppliers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('phone', 20)->nullable();
            $table->string('address')->nullable();
            $table->string('note')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->index(['tenant_id', 'name']);
        });

        Schema::create('purchases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('shop_id')->constrained();
            $table->foreignId('supplier_id')->nullable()->constrained();
            $table->string('reference', 32);
            $table->timestamp('occurred_at');
            $table->decimal('subtotal', 15, 2);
            $table->decimal('discount', 15, 2)->default(0);
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->decimal('total', 15, 2);
            // Somme des paiements confirmés, tenue à jour à chaque paiement.
            $table->decimal('paid_amount', 15, 2)->default(0);
            // paid, partial, unpaid.
            $table->string('payment_status', 16);
            // received, cancelled.
            $table->string('status', 16)->default('received');
            $table->foreignId('user_id')->constrained();
            $table->string('note')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users');
            $table->string('cancel_reason')->nullable();
            $table->timestamps();
            $table->unique(['tenant_id', 'reference']);
            $table->index(['shop_id', 'occurred_at']);
            $table->index(['tenant_id', 'supplier_id']);
        });

        Schema::create('purchase_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained();
            $table->foreignId('product_variant_id')->nullable()->constrained();
            // Unité de la ligne (un carton, par exemple) ; quantité et prix dans cette unité.
            $table->foreignId('unit_id')->constrained();
            $table->decimal('quantity', 15, 3);
            // Ce qui entre en stock, en unité de base (§7.3).
            $table->decimal('base_quantity', 15, 3);
            $table->decimal('cost', 15, 2);
            $table->decimal('discount', 15, 2)->default(0);
            $table->string('discount_method', 16)->nullable();
            $table->decimal('tax_rate', 5, 2)->nullable();
            $table->string('tax_method', 16)->nullable();
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->decimal('subtotal', 15, 2);
        });

        Schema::create('purchase_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_id')->constrained()->cascadeOnDelete();
            $table->foreignId('payment_method_id')->constrained();
            $table->decimal('amount', 15, 2);
            $table->timestamp('paid_at');
            $table->foreignId('user_id')->constrained();
            $table->string('note')->nullable();
            // completed, cancelled.
            $table->string('status', 16)->default('completed');
            $table->timestamps();
        });

        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('shop_id')->constrained();
            $table->string('reference', 32);
            $table->uuid('offline_uuid')->nullable();
            $table->timestamp('occurred_at');
            $table->foreignId('expense_category_id')->constrained();
            $table->decimal('amount', 15, 2);
            $table->foreignId('payment_method_id')->constrained();
            $table->string('note')->nullable();
            $table->foreignId('user_id')->constrained();
            // completed, cancelled.
            $table->string('status', 16)->default('completed');
            $table->timestamp('cancelled_at')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users');
            $table->string('cancel_reason')->nullable();
            $table->timestamps();
            $table->unique(['tenant_id', 'reference']);
            $table->unique(['tenant_id', 'offline_uuid']);
            $table->index(['shop_id', 'occurred_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expenses');
        Schema::dropIfExists('purchase_payments');
        Schema::dropIfExists('purchase_items');
        Schema::dropIfExists('purchases');
        Schema::dropIfExists('suppliers');
    }
};
