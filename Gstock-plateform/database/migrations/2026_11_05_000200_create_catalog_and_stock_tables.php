<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Catalogue et stock (§8.4, M06, M07). Le stock est tenu par (produit, variante,
 * boutique) en unité de base, et toujours égal à la somme des mouvements (§7.2).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            // simple, variable (variantes, mode avancé), service (pas de stock).
            $table->string('type', 16)->default('simple');
            $table->string('name');
            $table->string('code', 40);
            $table->string('barcode', 40)->nullable();
            $table->foreignId('category_id')->nullable()->constrained();
            $table->foreignId('brand_id')->nullable()->constrained();
            $table->foreignId('unit_id')->constrained();
            $table->foreignId('sale_unit_id')->nullable()->constrained('units');
            $table->foreignId('purchase_unit_id')->nullable()->constrained('units');
            // Prix d'achat par unité de base ; prix de vente (plus bas prix des variantes pour un produit à variantes).
            $table->decimal('cost', 15, 2)->nullable();
            $table->decimal('price', 15, 2);
            $table->decimal('tax_rate', 5, 2)->nullable();
            $table->string('tax_method', 16)->default('exclusive');
            $table->decimal('stock_alert', 15, 3)->nullable();
            $table->string('image_path')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['tenant_id', 'code']);
            $table->index(['tenant_id', 'name']);
        });
        // Code-barres unique dans l'espace (vérifié aussi entre produits et variantes par l'application).
        DB::statement('CREATE UNIQUE INDEX products_tenant_barcode_unique ON products (tenant_id, barcode) WHERE barcode IS NOT NULL');

        Schema::create('product_variants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('code', 40);
            $table->string('barcode', 40)->nullable();
            $table->decimal('cost', 15, 2)->nullable();
            $table->decimal('price', 15, 2);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['product_id', 'name']);
            $table->unique(['tenant_id', 'code']);
        });
        DB::statement('CREATE UNIQUE INDEX product_variants_tenant_barcode_unique ON product_variants (tenant_id, barcode) WHERE barcode IS NOT NULL');

        Schema::create('shop_stock', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('shop_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_variant_id')->nullable()->constrained()->cascadeOnDelete();
            $table->decimal('quantity', 15, 3)->default(0);
            // Surcharge du seuil d'alerte pour cette boutique (facultatif).
            $table->decimal('stock_alert', 15, 3)->nullable();
            $table->timestamps();
        });
        // Une seule ligne par (boutique, produit, variante), variante vide comprise.
        DB::statement('CREATE UNIQUE INDEX shop_stock_article_unique ON shop_stock (shop_id, product_id, product_variant_id) NULLS NOT DISTINCT');
        DB::statement('ALTER TABLE shop_stock ADD CONSTRAINT shop_stock_quantity_not_negative CHECK (quantity >= 0)');

        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('shop_id')->constrained();
            $table->foreignId('product_id')->constrained();
            $table->foreignId('product_variant_id')->nullable()->constrained();
            // Signée : positive pour une entrée, négative pour une sortie, en unité de base.
            $table->decimal('quantity', 15, 3);
            $table->decimal('unit_cost', 15, 2)->nullable();
            // opening, adjustment, adjustment_cancel, sale, sale_cancel, purchase, purchase_cancel.
            $table->string('source_type', 24);
            $table->unsignedBigInteger('source_id')->nullable();
            $table->string('reference', 32)->nullable();
            $table->string('reason')->nullable();
            $table->foreignId('user_id')->nullable()->constrained();
            $table->timestamp('occurred_at');
            $table->timestamp('created_at')->useCurrent();
            $table->index(['shop_id', 'product_id', 'product_variant_id', 'occurred_at']);
        });

        Schema::create('adjustments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('shop_id')->constrained();
            $table->string('reference', 32);
            // entry (entrée), exit (sortie), inventory (inventaire : écart compté).
            $table->string('kind', 16);
            $table->string('reason');
            $table->timestamp('occurred_at');
            $table->foreignId('user_id')->nullable()->constrained();
            $table->string('status', 16)->default('completed');
            $table->uuid('offline_uuid')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users');
            $table->string('cancel_reason')->nullable();
            $table->timestamps();
            $table->unique(['tenant_id', 'reference']);
            $table->unique(['tenant_id', 'offline_uuid']);
        });

        Schema::create('adjustment_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('adjustment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained();
            $table->foreignId('product_variant_id')->nullable()->constrained();
            // Entrée, sortie : quantité saisie ; inventaire : écart appliqué.
            $table->decimal('quantity', 15, 3);
            $table->decimal('counted_quantity', 15, 3)->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('adjustment_items');
        Schema::dropIfExists('adjustments');
        Schema::dropIfExists('stock_movements');
        Schema::dropIfExists('shop_stock');
        Schema::dropIfExists('product_variants');
        Schema::dropIfExists('products');
    }
};
