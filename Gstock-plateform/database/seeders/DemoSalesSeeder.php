<?php

namespace Database\Seeders;

use App\Domain\Catalog\Models\Product;
use App\Domain\Customers\Models\Customer;
use App\Domain\Identity\Models\User;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Sales\Models\Sale;
use App\Domain\Sales\SaleService;
use App\Domain\Shops\Models\Shop;
use App\Domain\Stock\StockLedger;
use App\Support\ApiException;
use Illuminate\Database\Seeder;

/**
 * Clients et historique de ventes de démonstration (§11.3), sur le modèle de
 * `Gstock-frontend/src/mocks/data/sales-seed.ts` : 30 clients du quartier, une
 * trentaine de jours de ventes (espèces, Mobile Money, en partie ou entièrement
 * à crédit), enregistrées par le vrai moteur de vente.
 */
class DemoSalesSeeder extends Seeder
{
    private const CUSTOMERS = [
        ['Awa Koné', '0748219033', 'Angré'], ['Mamadou Coulibaly', '0505112233', 'Angré'], ['Adjoua Kouassi', '0707445566', 'Riviera 2'],
        ['Yao Kouadio', null, 'Angré'], ['Fatoumata Diarra', '0101778899', 'Deux-Plateaux'], ['Serge Ahoua', '0566001122', 'Siporex'],
        ['Mariam Ouattara', '0749332211', 'Siporex'], ['Kofi Mensah', '0102030405', 'Yopougon Selmer'], ['Aïcha Touré', '0758665544', 'Angré'],
        ['Brou Kouamé', null, 'Siporex'], ['Salimata Sanogo', '0503998877', 'Riviera 3'], ['Jean-Marc Gnagne', '0700112244', 'Angré'],
        ['Rokia Traoré', '0544556677', 'Siporex'], ['Ibrahima Fofana', '0177889900', 'Yopougon Maroc'], ['Christelle Aka', '0709871234', 'Riviera 2'],
        ['Moussa Kanté', null, 'Siporex'], ['Nadège Yapi', '0565432198', 'Angré'], ['Abdoulaye Cissé', '0145671234', 'Siporex'],
        ['Clarisse N’Dri', '0778123456', 'Deux-Plateaux'], ['Lassina Bamba', '0599887766', 'Yopougon Selmer'], ['Prisca Kacou', '0712349876', 'Angré'],
        ['Oumar Sylla', null, 'Siporex'], ['Estelle Boni', '0123459876', 'Riviera 3'], ['Hamed Konaté', '0577665544', 'Siporex'],
        ['Viviane Koffi', '0745671239', 'Angré'], ['Souleymane Dembélé', '0136547890', 'Yopougon Maroc'], ['Béatrice Assi', '0703214569', 'Angré'],
        ['Drissa Keïta', '0598741236', 'Siporex'], ['Pauline Gbané', null, 'Riviera 2'], ['Zié Soro', '0147852369', 'Siporex'],
    ];

    /** Clients qui achètent à crédit (rangs dans la liste ci-dessus, à partir de 1). */
    private const CREDIT_CUSTOMERS = [1, 2, 3, 5, 6, 7, 9, 11, 13, 14, 17, 21];

    public function run(SaleService $sales, StockLedger $ledger): void
    {
        $tenant = Tenant::query()->where('slug', DemoTenantSeeder::SLUG)->firstOrFail();
        $tenant->run(function () use ($sales, $ledger) {
            if (Customer::query()->exists()) {
                return;
            }
            $customers = [];
            foreach (self::CUSTOMERS as $i => [$name, $phone, $district]) {
                $customers[$i + 1] = Customer::create(['name' => $name, 'phone' => $phone, 'district' => $district, 'note' => $i === 0 ? 'Cliente fidèle, paie en fin de mois.' : null])->id;
            }
            if (Sale::query()->exists()) {
                return;
            }

            mt_srand(20261103);
            $pick = fn (array $list) => $list[mt_rand(0, count($list) - 1)];
            $rand = fn () => mt_rand() / mt_getrandmax();
            $users = User::query()->get()->keyBy('email');
            $manager = $users['ibrahim@demo.gstock.app'];
            $shops = Shop::query()->orderBy('id')->get();
            $sellers = [$shops[0]->id => ['aminata', 'ibrahim', 'fatou'], $shops[1]->id => ['ibrahim', 'koffi']];
            // Produits simples seulement, hors produits qui illustrent les alertes de stock.
            $sellable = Product::query()->where('type', 'simple')->where('is_active', true)
                ->whereNotIn('name', ['Riz parfumé 5 kg', 'Huile Dinor 1 L', 'Savon de Marseille', 'Sucre en morceaux 1 kg', 'Lait en poudre 400 g', 'Eau minérale 1,5 L', 'Couches bébé (paquet de 30)', 'Gaz butane 6 kg (recharge)', 'Charbon de bois sac', 'Œufs (plateau de 30)'])
                ->get()->all();

            $start = now()->subDays(30)->startOfDay();
            for ($d = 0; $d <= 30; $d++) {
                foreach ($shops as $shop) {
                    $count = 4 + mt_rand(0, 3);
                    for ($k = 0; $k < $count; $k++) {
                        $at = $d === 30
                            ? now()->startOfDay()->addSeconds((int) ((($k + $rand()) / $count) * now()->diffInSeconds(now()->startOfDay(), true)))
                            : $start->copy()->addDays($d)->addHours(8 + $k * 2)->addMinutes(mt_rand(0, 59));
                        if ($at->isFuture()) {
                            continue;
                        }
                        $items = [];
                        $used = [];
                        $total = 0;
                        for ($n = 1 + mt_rand(0, 2); $n > 0; $n--) {
                            $p = $pick($sellable);
                            // On ne vend pas sous le seuil d'alerte : les alertes de la démo restent lisibles.
                            $room = (int) floor((float) $ledger->quantity($shop->id, $p->id, null)) - (int) ($p->stock_alert ?? 5) - 1;
                            if (isset($used[$p->id]) || $room < 1) {
                                continue;
                            }
                            $used[$p->id] = true;
                            $quantity = 1 + mt_rand(0, min(3, $room) - 1);
                            $items[] = ['product_id' => $p->id, 'quantity' => (string) $quantity];
                            $total += $quantity * (float) $p->price;
                        }
                        if (! $items) {
                            continue;
                        }
                        $r = $rand();
                        $mode = $r < 0.68 ? 'cash' : ($r < 0.84 ? 'mobile' : ($r < 0.94 ? 'partial' : 'credit'));
                        $customer = in_array($mode, ['partial', 'credit'], true) || $rand() < 0.3 ? $customers[$pick(self::CREDIT_CUSTOMERS)] : null;
                        $payments = match ($mode) {
                            'cash' => [['payment_method_id' => 1, 'amount' => (string) $total, 'cash_given' => (string) (ceil($total / 1000) * 1000)]],
                            'mobile' => [['payment_method_id' => 2, 'amount' => (string) $total]],
                            'partial' => [['payment_method_id' => 1, 'amount' => (string) (round(($total * (0.3 + $rand() * 0.4)) / 50) * 50)]],
                            default => [],
                        };
                        $user = $users[$pick($sellers[$shop->id]).'@demo.gstock.app'];
                        // Une vente à crédit est faite par quelqu'un qui en a le droit (le gérant si besoin).
                        if (in_array($mode, ['partial', 'credit'], true) && ! $user->hasAnyPermission('credits.create')) {
                            $user = $manager;
                        }
                        try {
                            $sales->record($shop, $user, ['items' => $items, 'payments' => $payments, 'customer_id' => $customer], at: $at);
                        } catch (ApiException) {
                            // Stock épuisé entre-temps : la vente n'a pas lieu, comme en boutique.
                        }
                    }
                }
            }
        });
    }
}
