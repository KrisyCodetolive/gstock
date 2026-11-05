<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Dates de péremption (§7.11) : pour un produit suivi, le stock de chaque boutique
 * est découpé en arrivages datés ou non. La somme des arrivages égale toujours
 * `shop_stock.quantity` ; chaque mouvement note les arrivages où il a puisé.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->boolean('track_expiry')->default(false);
            // Délai d'alerte propre au produit ; vide : celui de l'espace.
            $table->unsignedSmallInteger('expiry_alert_days')->nullable();
        });

        Schema::table('tenant_settings', function (Blueprint $table) {
            $table->unsignedSmallInteger('expiry_alert_days')->default(7);
        });

        Schema::create('stock_lots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('shop_id')->constrained();
            $table->foreignId('product_id')->constrained();
            $table->foreignId('product_variant_id')->nullable()->constrained();
            // Vide : arrivage sans date (stock présent avant le suivi, ou date non saisie).
            $table->date('expiry_date')->nullable();
            $table->decimal('initial_quantity', 15, 3);
            $table->decimal('quantity', 15, 3);
            $table->decimal('unit_cost', 15, 2)->nullable();
            // opening, adjustment, purchase, sale_cancel, tracking_start… (entrée d'origine).
            $table->string('source_type', 24);
            $table->unsignedBigInteger('source_id')->nullable();
            $table->string('reference', 32)->nullable();
            $table->timestamp('received_at');
            $table->timestamps();
            $table->index(['shop_id', 'product_id', 'product_variant_id', 'expiry_date']);
        });
        DB::statement('ALTER TABLE stock_lots ADD CONSTRAINT stock_lots_quantity_not_negative CHECK (quantity >= 0)');

        Schema::create('stock_lot_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('stock_lot_id')->constrained()->cascadeOnDelete();
            $table->foreignId('stock_movement_id')->nullable()->constrained();
            // Signée, comme le mouvement : + entrée dans l'arrivage, − sortie.
            $table->decimal('quantity', 15, 3);
            $table->timestamp('created_at')->useCurrent();
            $table->index('stock_movement_id');
        });

        Schema::table('adjustments', function (Blueprint $table) {
            // Sortie : expired, damaged, stolen, consumed, other (§7.11) ; les trois premiers sont des pertes (§7.8).
            $table->string('exit_reason', 16)->nullable();
        });

        Schema::table('adjustment_items', function (Blueprint $table) {
            $table->date('expiry_date')->nullable();
            $table->foreignId('stock_lot_id')->nullable()->constrained();
        });

        Schema::table('purchase_items', function (Blueprint $table) {
            $table->date('expiry_date')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('purchase_items', fn (Blueprint $table) => $table->dropColumn('expiry_date'));
        Schema::table('adjustment_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('stock_lot_id');
            $table->dropColumn('expiry_date');
        });
        Schema::table('adjustments', fn (Blueprint $table) => $table->dropColumn('exit_reason'));
        Schema::dropIfExists('stock_lot_movements');
        Schema::dropIfExists('stock_lots');
        Schema::table('tenant_settings', fn (Blueprint $table) => $table->dropColumn('expiry_alert_days'));
        Schema::table('products', fn (Blueprint $table) => $table->dropColumn(['track_expiry', 'expiry_alert_days']));
    }
};
