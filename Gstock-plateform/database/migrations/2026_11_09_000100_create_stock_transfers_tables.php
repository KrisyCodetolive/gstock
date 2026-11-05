<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Transferts de stock entre boutiques d'un même espace (§7.12) : envoi (le stock
 * sort et part « en route »), puis réception (il entre, les manques sont notés).
 * Nouvelle permission `stock.transfer`, accordée au seul rôle Owner (ADR-014).
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('permissions')->insert([
            'name' => 'stock.transfer', 'label' => 'Transférer du stock vers une autre boutique', 'group' => 'stock', 'level' => 'shop',
            'created_at' => now(), 'updated_at' => now(),
        ]);

        Schema::create('stock_transfers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('from_shop_id')->constrained('shops');
            $table->foreignId('to_shop_id')->constrained('shops');
            $table->string('reference', 32);
            // in_transit (en route), received (reçu), cancelled (annulé avant réception).
            $table->string('status', 16)->default('in_transit');
            $table->string('note')->nullable();
            $table->timestamp('sent_at');
            $table->foreignId('sent_by')->nullable()->constrained('users');
            $table->timestamp('received_at')->nullable();
            $table->foreignId('received_by')->nullable()->constrained('users');
            $table->string('reception_note')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users');
            $table->string('cancel_reason')->nullable();
            $table->timestamps();
            $table->unique(['tenant_id', 'reference']);
            $table->index(['to_shop_id', 'status']);
            $table->index(['from_shop_id', 'status']);
        });

        Schema::create('stock_transfer_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stock_transfer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained();
            $table->foreignId('product_variant_id')->nullable()->constrained();
            // En unité de base : envoyée, puis reçue (vide tant que le transfert est en route).
            $table->decimal('quantity', 15, 3);
            $table->decimal('received_quantity', 15, 3)->nullable();
            $table->decimal('unit_cost', 15, 2)->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_transfer_items');
        Schema::dropIfExists('stock_transfers');
        DB::table('permissions')->where('name', 'stock.transfer')->delete();
    }
};
