<?php

namespace Database\Seeders;

use App\Domain\Catalog\Models\Product;
use App\Domain\Expenses\ExpenseService;
use App\Domain\Expenses\Models\ExpenseCategory;
use App\Domain\Identity\Models\User;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Purchases\Models\Supplier;
use App\Domain\Purchases\PurchaseService;
use App\Domain\Shops\Models\Shop;
use App\Support\ApiException;
use Illuminate\Database\Seeder;

/**
 * Fournisseurs, approvisionnements et dépenses de démonstration (§11.3), sur le
 * modèle de `Gstock-frontend/src/mocks/data/purchases.ts` et `sales-seed.ts`,
 * enregistrés par les vrais services. « Jour 34 » = aujourd'hui.
 */
class DemoPurchasesSeeder extends Seeder
{
    private const SUPPLIERS = [
        ['Grossiste Adjamé Distribution', '0101020304', 'Marché d’Adjamé, Abidjan', 'Livraison le mardi.'],
        ['SIFCA Huiles', '0505060708', 'Zone industrielle de Yopougon', null],
        ['Brasseries du Plateau', '0707080910', 'Plateau, Abidjan', null],
        ['Moussa Commerce', '0144556677', 'Treichville', 'Paie à 30 jours.'],
        ['Hygiène Plus', null, 'Marcory', null],
    ];

    /** [jour, boutique (1 ou 2), fournisseur (rang), [[produit, quantité]], part payée]. */
    private const ARRIVALS = [
        [8, 1, 1, [['Riz local 1 kg', 20], ['Spaghetti 500 g', 24], ['Couscous 1 kg', 10]], 1],
        [12, 2, 2, [['Huile de palme 1 L', 12], ['Huile d’arachide 1 L', 6]], 0.5],
        [16, 1, 3, [['Eau minérale 1,5 L', 48], ['Fanta orange 33 cl', 24], ['Jus de bissap 1 L', 12]], 1],
        [21, 2, 4, [['Sucre en poudre 1 kg', 20], ['Farine de blé 1 kg', 15], ['Lait concentré sucré', 24]], 0],
        [25, 1, 5, [['Dentifrice 75 ml', 12], ['Papier toilette (4 rouleaux)', 10], ['Savon Lux', 24]], 0.4],
        [28, 2, 1, [['Riz local 1 kg', 15], ['Tomate concentrée 70 g', 40]], 1],
    ];

    /** [jour, boutique, catégorie, montant, note]. */
    private const EXPENSES = [
        [5, 1, 'Loyer', 75000, 'Loyer d’octobre'], [5, 2, 'Loyer', 60000, 'Loyer d’octobre'],
        [9, 1, 'Transport', 3000, 'Taxi pour le marché'], [11, 2, 'Transport', 2500, null],
        [14, 1, 'Électricité', 18500, 'Facture CIE'], [14, 2, 'Électricité', 15200, 'Facture CIE'],
        [18, 1, 'Internet', 10000, 'Forfait internet'], [22, 2, 'Transport', 4000, 'Livraison'],
        [30, 1, 'Personnel', 40000, 'Aide de Fatou'], [30, 2, 'Personnel', 35000, null],
        [31, 1, 'Autres dépenses', 1500, 'Sacs plastiques'], [32, 2, 'Autres dépenses', 2000, 'Balai et seau'],
    ];

    public function run(PurchaseService $purchases, ExpenseService $expenses): void
    {
        $tenant = Tenant::query()->where('slug', DemoTenantSeeder::SLUG)->firstOrFail();
        $tenant->run(function () use ($purchases, $expenses) {
            if (Supplier::query()->exists()) {
                return;
            }
            $suppliers = [];
            foreach (self::SUPPLIERS as $i => [$name, $phone, $address, $note]) {
                $suppliers[$i + 1] = Supplier::create(['name' => $name, 'phone' => $phone, 'address' => $address, 'note' => $note])->id;
            }
            $shops = Shop::query()->orderBy('id')->get()->values();
            $day = fn (int $d, int $hour = 10) => now()->subDays(34 - $d)->setTime($hour, 0);

            // Approvisionnements (M11) par le gestionnaire de stock ; une partie payée plus tard.
            $stockKeeper = User::query()->where('email', 'moussa@demo.gstock.app')->firstOrFail();
            foreach (self::ARRIVALS as [$d, $shop, $supplier, $lines, $share]) {
                $items = [];
                $total = 0;
                foreach ($lines as [$name, $quantity]) {
                    $p = Product::query()->where('name', $name)->first();
                    if ($p) {
                        $items[] = ['product_id' => $p->id, 'quantity' => (string) $quantity, 'cost' => (string) ($p->cost ?? 0)];
                        $total += $quantity * (float) $p->cost;
                    }
                }
                $paid = round(($total * $share) / 50) * 50;
                try {
                    $purchase = $purchases->record($shops[$shop - 1], $stockKeeper, [
                        'items' => $items, 'supplier_id' => $suppliers[$supplier],
                        ...($paid > 0 ? ['paid_amount' => (string) $paid, 'payment_method_id' => 1] : []),
                    ], at: $day($d));
                    // Dette fournisseur « à 30 jours » : un échéancier dont la première échéance est dépassée (§7.7).
                    if ($share === 0) {
                        $half = round((float) $purchase->total / 2);
                        $purchases->setInstallments($purchase, [
                            ['due_date' => now()->subDays(3)->toDateString(), 'amount' => (string) $half],
                            ['due_date' => now()->addDays(10)->toDateString(), 'amount' => (string) ((float) $purchase->total - $half)],
                        ]);
                    }
                } catch (ApiException) {
                    // Produit absent du catalogue de démonstration : on passe.
                }
            }

            // Dépenses (M12) par la propriétaire.
            $owner = User::query()->where('email', 'aminata@demo.gstock.app')->firstOrFail();
            $categories = ExpenseCategory::query()->pluck('id', 'name');
            foreach (self::EXPENSES as [$d, $shop, $category, $amount, $note]) {
                $expenses->record($shops[$shop - 1], $owner, [
                    'expense_category_id' => $categories[$category], 'amount' => (string) $amount, 'payment_method_id' => 1,
                    'occurred_at' => $day($d, 17)->toIso8601String(), 'note' => $note,
                ]);
            }
        });
    }
}
