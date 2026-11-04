<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Identité et accès (§6, §8.3, ADR-014) : permissions fixes, rôles libres par
 * espace, un rôle par utilisateur, affectation aux boutiques.
 */
return new class extends Migration
{
    /**
     * Liste fixe des permissions (§6.3). Une nouvelle permission s'ajoute par une
     * nouvelle migration et n'est accordée qu'au rôle Owner.
     */
    private const PERMISSIONS = [
        ['subscription.manage', "Gérer l'abonnement", 'subscription', 'tenant'],
        ['shops.manage', 'Gérer les boutiques', 'shops', 'tenant'],
        ['users.manage', 'Gérer les utilisateurs', 'users', 'tenant'],
        ['roles.manage', 'Gérer les rôles', 'users', 'tenant'],
        ['settings.manage', "Modifier les paramètres de l'espace", 'settings', 'tenant'],
        ['payment_settings.manage', 'Gérer les paiements en ligne (GeniusPay)', 'settings', 'tenant'],
        ['products.view', 'Voir les produits', 'catalog', 'tenant'],
        ['products.create', 'Ajouter des produits', 'catalog', 'tenant'],
        ['products.update', 'Modifier des produits', 'catalog', 'tenant'],
        ['products.disable', 'Désactiver des produits', 'catalog', 'tenant'],
        ['categories.manage', 'Gérer les catégories de produits', 'catalog', 'tenant'],
        ['units.manage', 'Gérer les unités', 'catalog', 'tenant'],
        ['customers.view', 'Voir les clients', 'customers', 'tenant'],
        ['customers.create', 'Ajouter des clients', 'customers', 'tenant'],
        ['customers.update', 'Modifier des clients', 'customers', 'tenant'],
        ['suppliers.view', 'Voir les fournisseurs', 'suppliers', 'tenant'],
        ['suppliers.manage', 'Gérer les fournisseurs', 'suppliers', 'tenant'],
        ['dashboard.view', 'Voir le tableau de bord', 'general', 'shop'],
        ['records.view_all', 'Voir les opérations de tout le monde', 'general', 'shop'],
        ['audit.view', "Voir le journal d'activité", 'general', 'shop'],
        ['sales.create', 'Vendre', 'sales', 'shop'],
        ['sales.view', 'Voir les ventes', 'sales', 'shop'],
        ['sales.cancel', 'Annuler une vente', 'sales', 'shop'],
        ['sales.edit_price', 'Modifier le prix pendant une vente', 'sales', 'shop'],
        ['sales.give_discount', 'Faire une remise', 'sales', 'shop'],
        ['credits.view', 'Voir les crédits clients', 'credits', 'shop'],
        ['credits.create', 'Mettre à crédit', 'credits', 'shop'],
        ['credits.cancel', 'Annuler un crédit', 'credits', 'shop'],
        ['credits.opening_balance', 'Saisir un ancien crédit', 'credits', 'shop'],
        ['repayments.create', 'Recevoir un paiement de crédit', 'credits', 'shop'],
        ['repayments.cancel', 'Annuler un paiement de crédit', 'credits', 'shop'],
        ['stock.view', 'Voir le stock', 'stock', 'shop'],
        ['stock.entry', 'Ajouter du stock', 'stock', 'shop'],
        ['stock.exit', 'Retirer du stock', 'stock', 'shop'],
        ['stock.adjust', 'Faire un inventaire', 'stock', 'shop'],
        ['purchases.view', 'Voir les approvisionnements', 'purchases', 'shop'],
        ['purchases.create', 'Enregistrer un approvisionnement', 'purchases', 'shop'],
        ['purchases.cancel', 'Annuler un approvisionnement', 'purchases', 'shop'],
        ['purchase_payments.create', 'Payer un fournisseur', 'purchases', 'shop'],
        ['expenses.view', 'Voir les dépenses', 'expenses', 'shop'],
        ['expenses.create', 'Enregistrer une dépense', 'expenses', 'shop'],
        ['expenses.cancel', 'Annuler une dépense', 'expenses', 'shop'],
    ];

    public function up(): void
    {
        // Table globale, sans tenant_id, remplie ici et jamais modifiée par l'interface.
        Schema::create('permissions', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('label');
            $table->string('group');
            $table->string('level');
            $table->timestamps();
        });

        $now = now();
        DB::table('permissions')->insert(array_map(fn (array $p) => [
            'name' => $p[0], 'label' => $p[1], 'group' => $p[2], 'level' => $p[3], 'created_at' => $now, 'updated_at' => $now,
        ], self::PERMISSIONS));

        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('description')->nullable();
            // Vrai seulement pour le rôle Owner, créé à l'inscription et protégé.
            $table->boolean('is_owner')->default(false);
            $table->timestamps();
            $table->unique(['tenant_id', 'name']);
        });

        Schema::create('permission_role', function (Blueprint $table) {
            $table->foreignId('permission_id')->constrained()->cascadeOnDelete();
            $table->foreignId('role_id')->constrained()->cascadeOnDelete();
            $table->primary(['permission_id', 'role_id']);
        });

        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('firstname');
            $table->string('lastname');
            // E-mail ou téléphone (au moins l'un des deux) : identifiants de connexion, uniques dans l'espace.
            $table->string('email')->nullable();
            $table->string('phone', 20)->nullable();
            $table->string('password');
            $table->string('avatar_path')->nullable();
            $table->foreignId('role_id')->constrained();
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_login_at')->nullable();
            $table->rememberToken();
            $table->timestamps();
            $table->unique(['tenant_id', 'email']);
            $table->unique(['tenant_id', 'phone']);
        });

        // Un e-mail n'est unique que dans son espace : le jeton est rattaché à l'utilisateur.
        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('token_hash', 64)->unique();
            $table->timestamp('expires_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('users');
        Schema::dropIfExists('permission_role');
        Schema::dropIfExists('roles');
        Schema::dropIfExists('permissions');
    }
};
