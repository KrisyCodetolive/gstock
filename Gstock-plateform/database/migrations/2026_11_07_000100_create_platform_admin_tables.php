<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Back-office de Genius Groups (M01, ADR-010) : comptes des super-admins (garde
 * `platform`, séparée des utilisateurs des espaces), journal de leurs actions,
 * et suspension manuelle d'un espace.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('platform_admins', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password');
            $table->boolean('is_active')->default(true);
            $table->rememberToken();
            $table->timestamp('last_login_at')->nullable();
            $table->timestamps();
        });

        Schema::create('platform_audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('platform_admin_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action');
            // Espace concerné, s'il y en a un.
            $table->foreignId('tenant_id')->nullable()->constrained()->nullOnDelete();
            $table->string('subject_type')->nullable();
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->string('subject_label')->nullable();
            $table->text('reason')->nullable();
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->string('ip', 45)->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['tenant_id', 'created_at']);
            $table->index(['action', 'created_at']);
        });

        // Suspension décidée par Genius Groups : l'espace passe en lecture seule, quel que soit l'abonnement.
        Schema::table('tenants', function (Blueprint $table) {
            $table->timestamp('suspended_at')->nullable();
            $table->string('suspension_reason')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('tenants', fn (Blueprint $table) => $table->dropColumn(['suspended_at', 'suspension_reason']));
        Schema::dropIfExists('platform_audit_logs');
        Schema::dropIfExists('platform_admins');
    }
};
