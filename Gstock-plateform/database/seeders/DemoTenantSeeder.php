<?php

namespace Database\Seeders;

use App\Domain\Catalog\Models\Brand;
use App\Domain\Catalog\Models\Category;
use App\Domain\Identity\Models\Permission;
use App\Domain\Identity\Models\Role;
use App\Domain\Identity\Models\User;
use App\Domain\Platform\Actions\ProvisionTenant;
use App\Domain\Platform\Models\Plan;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Platform\Models\TenantInvoice;
use App\Domain\Sales\Models\PaymentMethod;
use App\Domain\Shops\Models\Shop;
use App\Domain\Shops\Models\TenantSetting;
use Illuminate\Database\Seeder;

/**
 * Espace de démonstration, identique à celui des données simulées du frontend
 * (`Gstock-frontend/src/mocks/data/`) : Alimentation Koné, deux boutiques, le
 * propriétaire et quatre rôles créés par lui. Mot de passe commun : demo1234.
 * Adresse en développement : http://alimentation-kone.localhost:5173
 */
class DemoTenantSeeder extends Seeder
{
    public const SLUG = 'alimentation-kone';

    public const PASSWORD = 'demo1234';

    public function run(ProvisionTenant $provision): void
    {
        if (Tenant::query()->where('slug', self::SLUG)->exists()) {
            return;
        }

        ['tenant' => $tenant] = $provision->handle([
            'name' => 'Alimentation Koné',
            'slug' => self::SLUG,
            'phone' => '0700000001',
            'plan' => Plan::query()->where('name', 'Commerce')->firstOrFail(),
            'shop' => ['name' => 'Boutique Cocody', 'city' => 'Abidjan', 'district' => 'Angré', 'address' => 'Carrefour Angré Château', 'phone' => '0700000011'],
            'owner' => ['firstname' => 'Aminata', 'lastname' => 'Koné', 'email' => 'aminata@demo.gstock.app', 'phone' => '0700000001', 'password' => self::PASSWORD],
        ]);

        // Essai terminé, deux mois payés, en cours pour encore deux semaines.
        $tenant->subscription->update(['starts_at' => now()->subDays(60), 'trial_ends_at' => now()->subDays(46), 'ends_at' => now()->addDays(14), 'status' => 'active']);
        $tenant->update(['status' => 'active', 'activated_at' => now()->subDays(60)]);
        // Factures d'abonnement : la première période, puis un paiement refusé suivi d'un paiement réussi.
        foreach ([[46, 'paid', 'Wave'], [16, 'failed', 'Orange Money'], [16, 'paid', 'Orange Money']] as $i => [$days, $status, $channel]) {
            $at = now()->subDays($days)->setTime(10 + $i, 0);
            $invoice = TenantInvoice::create([
                'tenant_id' => $tenant->id, 'tenant_subscription_id' => $tenant->subscription->id, 'plan_id' => $tenant->subscription->plan_id,
                'reference' => 'FA-demo-'.$i, 'amount' => $tenant->subscription->plan->price, 'status' => $status, 'payment_channel' => $channel,
                'geniuspay_transaction_id' => 'GP-DEMO-'.($i + 1), 'paid_at' => $status === 'paid' ? $at : null, 'created_at' => $at, 'updated_at' => $at,
            ]);
            $invoice->update(['reference' => "FA-{$invoice->id}"]);
        }

        $tenant->run(function () {
            TenantSetting::query()->first()->update([
                'email' => 'contact@alimentation-kone.ci',
                'address' => 'Angré 8e tranche, Cocody, Abidjan',
                'receipt_footer' => 'Merci pour votre confiance. À bientôt !',
            ]);
            // Catégories et marques du catalogue de démonstration (mêmes que les données simulées).
            foreach ([
                ['Riz et céréales', 'peach'], ['Huiles', 'yellow'], ['Boissons', 'mint'], ['Savons et entretien', 'lavender'],
                ['Sucre et farine', 'peach'], ['Lait et petit-déjeuner', 'mint'], ['Conserves et condiments', 'yellow'], ['Hygiène', 'lavender'],
            ] as [$name, $color]) {
                Category::create(['name' => $name, 'color' => $color]);
            }
            Brand::create(['name' => 'Dinor']);
            Brand::create(['name' => 'Uncle Ben’s']);
            // Paiement par carte pas encore proposé dans cet espace.
            PaymentMethod::query()->where('type', 'card')->update(['is_active' => false]);

            $cocody = Shop::query()->where('name', 'Boutique Cocody')->firstOrFail();
            $yopougon = Shop::create(['name' => 'Boutique Yopougon', 'city' => 'Abidjan', 'district' => 'Siporex', 'address' => 'Face à la pharmacie Siporex', 'phone' => '0700000012']);

            $roles = [];
            foreach (self::roles() as $name => [$description, $permissions]) {
                $role = Role::create(['name' => $name, 'description' => $description]);
                $role->permissions()->sync(Permission::query()->whereIn('name', $permissions)->pluck('id'));
                $roles[$name] = $role;
            }

            foreach ([
                ['Ibrahim', 'Traoré', 2, 'Gérant', [$cocody, $yopougon], true],
                ['Fatou', 'Bamba', 3, 'Vendeur', [$cocody], true],
                ['Koffi', "N'Guessan", 4, 'Caissier', [$yopougon], true],
                ['Moussa', 'Diallo', 5, 'Gestionnaire de stock', [$cocody, $yopougon], true],
                ['Paul', 'Yao', 6, 'Vendeur', [$cocody], false],
            ] as [$firstname, $lastname, $n, $role, $shops, $active]) {
                $user = User::create([
                    'firstname' => $firstname, 'lastname' => $lastname,
                    'email' => mb_strtolower(str_replace("'", '', iconv('UTF-8', 'ASCII//TRANSLIT', $firstname))).'@demo.gstock.app',
                    'phone' => '070000000'.$n, 'password' => self::PASSWORD,
                    'role_id' => $roles[$role]->id, 'is_active' => $active,
                ]);
                $user->shops()->sync(collect($shops)->pluck('id'));
            }
        });
    }

    /** @return array<string, array{0: string, 1: list<string>}> */
    private static function roles(): array
    {
        return [
            'Gérant' => ['Gère les boutiques au quotidien.', [
                'products.view', 'products.create', 'products.update', 'products.disable', 'categories.manage', 'units.manage',
                'customers.view', 'customers.create', 'customers.update', 'suppliers.view', 'suppliers.manage',
                'dashboard.view', 'records.view_all', 'audit.view',
                'sales.create', 'sales.view', 'sales.cancel', 'sales.edit_price', 'sales.give_discount',
                'credits.view', 'credits.create', 'credits.cancel', 'credits.opening_balance', 'repayments.create', 'repayments.cancel',
                'stock.view', 'stock.entry', 'stock.exit', 'stock.adjust',
                'purchases.view', 'purchases.create', 'purchases.cancel', 'purchase_payments.create',
                'expenses.view', 'expenses.create', 'expenses.cancel',
            ]],
            'Vendeur' => ['Vend et met à crédit.', [
                'products.view', 'customers.view', 'customers.create', 'dashboard.view', 'sales.create', 'sales.view',
                'credits.view', 'credits.create', 'stock.view',
            ]],
            'Caissier' => ['Encaisse les ventes et les remboursements.', [
                'products.view', 'customers.view', 'dashboard.view', 'sales.create', 'sales.view',
                'credits.view', 'repayments.create', 'expenses.view', 'expenses.create',
            ]],
            'Gestionnaire de stock' => ['Reçoit la marchandise et tient le stock.', [
                'products.view', 'products.create', 'products.update', 'categories.manage', 'units.manage',
                'suppliers.view', 'suppliers.manage', 'dashboard.view',
                'stock.view', 'stock.entry', 'stock.exit', 'stock.adjust', 'purchases.view', 'purchases.create',
            ]],
        ];
    }
}
