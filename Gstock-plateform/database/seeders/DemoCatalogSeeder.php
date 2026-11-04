<?php

namespace Database\Seeders;

use App\Domain\Catalog\Models\Category;
use App\Domain\Catalog\Models\Product;
use App\Domain\Catalog\Models\Unit;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Shops\Models\Shop;
use App\Domain\Stock\StockChange;
use App\Domain\Stock\StockLedger;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Catalogue de démonstration (§11.3), identique à `Gstock-frontend/src/mocks/data/products.ts` :
 * ~60 produits du quotidien, un service, un produit à variantes, et leur stock de
 * départ dans chaque boutique, saisi par des mouvements « stock initial » (§7.2).
 */
class DemoCatalogSeeder extends Seeder
{
    /** [nom, catégorie, unité, prix d'achat, prix de vente, seuil, code-barres] */
    private const ROWS = [
        ['Riz parfumé 5 kg', 'Riz et céréales', 'Unité', 3900, 4500, 5, '6181100100015'],
        ['Riz parfumé 25 kg', 'Riz et céréales', 'Unité', 18500, 21000, 2, '6181100100022'],
        ['Riz local 1 kg', 'Riz et céréales', 'Kilogramme', 450, 550, 10, null],
        ['Maïs en grains 1 kg', 'Riz et céréales', 'Kilogramme', 250, 350, 10, null],
        ['Attiéké sachet', 'Riz et céréales', 'Sachet', 150, 200, 15, null],
        ['Spaghetti 500 g', 'Riz et céréales', 'Paquet', 300, 400, 12, '6181100100039'],
        ['Couscous 1 kg', 'Riz et céréales', 'Paquet', 900, 1100, 6, null],
        ['Huile Dinor 1 L', 'Huiles', 'Bouteille', 1150, 1350, 6, '6181100200012'],
        ['Huile Dinor 5 L', 'Huiles', 'Bouteille', 5600, 6500, 3, '6181100200029'],
        ['Huile de palme 1 L', 'Huiles', 'Bouteille', 700, 900, 6, null],
        ['Huile d’arachide 1 L', 'Huiles', 'Bouteille', 1300, 1500, 4, null],
        ['Eau minérale 1,5 L', 'Boissons', 'Bouteille', 250, 350, 24, '6181100300019'],
        ['Eau minérale pack de 6', 'Boissons', 'Paquet', 1400, 1800, 6, null],
        ['Coca-Cola 33 cl', 'Boissons', 'Unité', 300, 400, 24, '5449000000996'],
        ['Fanta orange 33 cl', 'Boissons', 'Unité', 300, 400, 24, '5449000011527'],
        ['Jus de bissap 1 L', 'Boissons', 'Bouteille', 500, 700, 8, null],
        ['Bière Flag 65 cl', 'Boissons', 'Bouteille', 500, 650, 24, null],
        ['Jus de gingembre 50 cl', 'Boissons', 'Bouteille', 300, 500, 10, null],
        ['Savon de Marseille', 'Savons et entretien', 'Unité', 220, 300, 20, null],
        ['Savon Lux', 'Savons et entretien', 'Unité', 300, 400, 20, '8999999003553'],
        ['Lessive en poudre 500 g', 'Savons et entretien', 'Paquet', 600, 800, 10, null],
        ['Eau de Javel 1 L', 'Savons et entretien', 'Bouteille', 400, 550, 8, null],
        ['Liquide vaisselle 500 ml', 'Savons et entretien', 'Bouteille', 550, 750, 6, null],
        ['Éponge à récurer', 'Savons et entretien', 'Unité', 100, 150, 15, null],
        ['Sucre en morceaux 1 kg', 'Sucre et farine', 'Paquet', 750, 900, 10, '6181100500016'],
        ['Sucre en poudre 1 kg', 'Sucre et farine', 'Kilogramme', 700, 850, 10, null],
        ['Farine de blé 1 kg', 'Sucre et farine', 'Kilogramme', 550, 700, 8, null],
        ['Levure boulangère', 'Sucre et farine', 'Sachet', 100, 150, 20, null],
        ['Lait en poudre 400 g', 'Lait et petit-déjeuner', 'Paquet', 2200, 2600, 6, '6181100600013'],
        ['Lait concentré sucré', 'Lait et petit-déjeuner', 'Unité', 450, 600, 12, null],
        ['Café soluble 50 g', 'Lait et petit-déjeuner', 'Unité', 1100, 1400, 6, null],
        ['Thé vert 25 sachets', 'Lait et petit-déjeuner', 'Paquet', 500, 700, 8, null],
        ['Chocolat en poudre 400 g', 'Lait et petit-déjeuner', 'Paquet', 1800, 2200, 4, null],
        ['Pain de mie', 'Lait et petit-déjeuner', 'Unité', 600, 800, 5, null],
        ['Biscuits secs', 'Lait et petit-déjeuner', 'Paquet', 150, 200, 20, null],
        ['Tomate concentrée 70 g', 'Conserves et condiments', 'Unité', 75, 100, 40, null],
        ['Tomate concentrée 400 g', 'Conserves et condiments', 'Unité', 450, 600, 10, null],
        ['Cube Maggi (boîte de 100)', 'Conserves et condiments', 'Paquet', 1800, 2200, 4, '7613036000000'],
        ['Sardines à l’huile', 'Conserves et condiments', 'Unité', 400, 550, 12, null],
        ['Mayonnaise 250 g', 'Conserves et condiments', 'Bouteille', 800, 1050, 5, null],
        ['Sel fin 1 kg', 'Conserves et condiments', 'Paquet', 200, 300, 10, null],
        ['Piment en poudre', 'Conserves et condiments', 'Sachet', 150, 250, 10, null],
        ['Moutarde 200 g', 'Conserves et condiments', 'Bouteille', 600, 800, 4, null],
        ['Dentifrice 75 ml', 'Hygiène', 'Unité', 500, 700, 8, null],
        ['Brosse à dents', 'Hygiène', 'Unité', 250, 400, 10, null],
        ['Papier toilette (4 rouleaux)', 'Hygiène', 'Paquet', 700, 1000, 6, null],
        ['Serviettes hygiéniques', 'Hygiène', 'Paquet', 600, 850, 8, null],
        ['Couches bébé (paquet de 30)', 'Hygiène', 'Paquet', 3800, 4500, 3, null],
        ['Crème de beauté 250 ml', 'Hygiène', 'Bouteille', 1200, 1600, 4, null],
        ['Allumettes (paquet de 10)', 'Savons et entretien', 'Paquet', 100, 150, 10, null],
        ['Bougies (paquet de 6)', 'Savons et entretien', 'Paquet', 400, 600, 6, null],
        ['Piles AA (lot de 4)', 'Savons et entretien', 'Paquet', 600, 900, 5, null],
        ['Charbon de bois sac', 'Savons et entretien', 'Unité', 2500, 3200, 3, null],
        ['Gaz butane 6 kg (recharge)', 'Savons et entretien', 'Unité', 4500, 5000, 2, null],
        ['Œufs (plateau de 30)', 'Lait et petit-déjeuner', 'Unité', 2700, 3200, 3, null],
        ['Oignons 1 kg', 'Conserves et condiments', 'Kilogramme', 500, 700, 8, null],
        ['Ail en tête', 'Conserves et condiments', 'Unité', 100, 150, 15, null],
        ['Arachides grillées sachet', 'Riz et céréales', 'Sachet', 75, 100, 20, null],
        ['Vinaigre 1 L', 'Conserves et condiments', 'Bouteille', 450, 600, 4, null],
    ];

    /** Stock de départ imposé (Cocody, Yopougon) : produits en alerte ou en rupture pour la démo. */
    private const STOCK_FIXED = [
        'Riz parfumé 5 kg' => [24, 18],
        'Huile Dinor 1 L' => [3, 14],
        'Savon de Marseille' => [0, 25],
        'Sucre en morceaux 1 kg' => [40, 9],
        'Lait en poudre 400 g' => [5, 0],
        'Cube Maggi (boîte de 100)' => [2, 6],
        'Gaz butane 6 kg (recharge)' => [1, 3],
        'Couches bébé (paquet de 30)' => [0, 2],
        'Coca-Cola 33 cl' => [72, 48],
        'Bière Flag 65 cl' => [36, 0],
    ];

    /** Boissons et savons s'achètent au carton de 12. */
    private const CARTON = ['Coca-Cola 33 cl', 'Fanta orange 33 cl', 'Savon de Marseille', 'Savon Lux'];

    public function run(StockLedger $ledger): void
    {
        $tenant = Tenant::query()->where('slug', DemoTenantSeeder::SLUG)->firstOrFail();
        $tenant->run(function () use ($ledger) {
            if (Product::query()->exists()) {
                return;
            }
            $categories = Category::query()->pluck('id', 'name');
            $units = Unit::query()->pluck('id', 'name');
            $shops = Shop::query()->orderBy('id')->pluck('id')->all();
            $opening = now()->subDays(34)->setTime(8, 0);
            $code = 0;
            $changes = [];

            foreach (self::ROWS as $index => [$name, $category, $unit, $cost, $price, $alert, $barcode]) {
                $product = Product::create([
                    'type' => 'simple', 'name' => $name, 'code' => sprintf('P-%04d', ++$code),
                    'barcode' => $barcode === null ? null : self::ean13((string) $barcode),
                    'category_id' => $categories[$category], 'brand_id' => null, 'unit_id' => $units[$unit],
                    'purchase_unit_id' => in_array($name, self::CARTON, true) ? $units['Carton'] : null,
                    'cost' => $cost, 'price' => $price, 'stock_alert' => $alert,
                ]);
                $ledger->ensureRows($product);
                foreach ($shops as $i => $shopId) {
                    $quantity = self::STOCK_FIXED[$name][$i] ?? self::defaultStock($index, $i + 1, $alert);
                    if ($quantity > 0) {
                        $changes[] = new StockChange($shopId, $product, null, (string) $quantity);
                    }
                }
            }

            Product::create([
                'type' => 'service', 'name' => 'Livraison à domicile', 'code' => sprintf('P-%04d', ++$code),
                'unit_id' => $units['Unité'], 'price' => 500,
            ]);

            // Un produit à variantes (mode avancé) : chaque parfum a son prix et son stock.
            $juice = Product::create([
                'type' => 'variable', 'name' => 'Jus de fruits 1 L', 'code' => sprintf('P-%04d', ++$code),
                'category_id' => $categories['Boissons'], 'unit_id' => $units['Bouteille'],
                'cost' => 600, 'price' => 900, 'stock_alert' => 4,
            ]);
            foreach ([['Ananas', 700, 1000, '618110090001', [12, 6]], ['Bissap', 600, 900, '618110090002', [3, 10]], ['Gingembre', 600, 900, '618110090003', [8, 0]]] as $n => [$name, $cost, $price, $barcode, $stock]) {
                $variant = $juice->variants()->create(['name' => $name, 'code' => $juice->code.'-'.($n + 1), 'barcode' => self::ean13($barcode), 'cost' => $cost, 'price' => $price]);
                foreach ($shops as $i => $shopId) {
                    if (($stock[$i] ?? 0) > 0) {
                        $changes[] = new StockChange($shopId, $juice, $variant->id, (string) $stock[$i]);
                    }
                }
            }
            $ledger->ensureRows($juice->load('variants'));
            $ledger->apply($changes, ['source_type' => 'opening', 'reason' => 'Stock initial', 'user_id' => 1, 'occurred_at' => $opening]);
            // Les prochains produits continuent la numérotation (P-0062…).
            DB::table('document_sequences')->updateOrInsert(
                ['tenant_id' => tenant('id'), 'document_type' => 'P'],
                ['next_number' => $code + 1, 'created_at' => now(), 'updated_at' => now()],
            );
        });
    }

    /** Même formule que les données simulées. */
    private static function defaultStock(int $index, int $shop, int $alert): int
    {
        $n = (($index + 3) * ($shop === 1 ? 37 : 53)) % 41;

        return $alert + ($n % ($alert * 3 + 5));
    }

    /** Codes EAN-13 valides : le dernier chiffre est la clé de contrôle. */
    private static function ean13(string $code): string
    {
        $digits = array_map('intval', str_split(substr($code, 0, 12)));
        $sum = 0;
        foreach ($digits as $i => $d) {
            $sum += $d * ($i % 2 ? 3 : 1);
        }

        return substr($code, 0, 12).((10 - $sum % 10) % 10);
    }
}
