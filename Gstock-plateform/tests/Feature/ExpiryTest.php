<?php

namespace Tests\Feature;

use App\Domain\Identity\Models\User;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Shops\Models\Shop;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Dates de péremption (§7.11) : arrivages par entrée de marchandise, sortie de la date
 * la plus proche, annulations rendues à leur arrivage, sortie « Périmé » d'un arrivage
 * précis, pertes (§7.8), approvisionnement entamé non annulable, alertes.
 */
class ExpiryTest extends TestCase
{
    private Tenant $tenant;

    private Shop $shop;

    private User $owner;

    private int $cash;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(now()->setTime(12, 0));
        ['tenant' => $this->tenant, 'owner' => $this->owner, 'shop' => $this->shop] = $this->createTenant();
        $this->cash = $this->tenant->run(fn () => DB::table('payment_methods')->where('type', 'cash')->value('id'));
    }

    public function test_a_tracked_product_keeps_its_stock_by_date_and_sells_the_nearest_date_first(): void
    {
        $id = $this->yoghurt(initial: '10', expiry: $this->day(20));
        $this->entry($id, '5', $this->day(3));
        $this->entry($id, '4', null);

        // Ordre de sortie : date la plus proche, puis la suivante, puis sans date.
        $this->assertSame([[$this->day(3), '5.000'], [$this->day(20), '10.000'], [null, '4.000']], $this->lots($id));

        $sale = $this->sell($id, '7')->json('data.id');
        $this->assertSame([[$this->day(20), '8.000'], [null, '4.000']], $this->lots($id));

        // Annulation : chaque quantité retourne dans son arrivage d'origine.
        $this->api('kone', 'POST', $this->url("/sales/{$sale}/cancel"), ['reason' => 'Erreur'], as: $this->owner)->assertOk();
        $this->assertSame([[$this->day(3), '5.000'], [$this->day(20), '10.000'], [null, '4.000']], $this->lots($id));
        $this->assertLotsMatchStock();
    }

    public function test_expired_goods_leave_from_their_own_arrival_and_count_as_losses(): void
    {
        $id = $this->yoghurt(initial: '10', expiry: $this->day(-2), cost: '300');
        $this->entry($id, '6', $this->day(30));
        $expired = $this->lotIds($id)[0];

        $post = fn (array $item, string $reason = 'expired') => $this->api('kone', 'POST', $this->url('/adjustments'), [
            'kind' => 'exit', 'reason' => 'Produit périmé', 'exit_reason' => $reason, 'items' => [['product_id' => $id, ...$item]],
        ], as: $this->owner);
        $post(['quantity' => '11', 'stock_lot_id' => $expired])->assertUnprocessable()
            ->assertJsonPath('errors.items.0', 'Il ne reste que 10 u de Yaourt nature dans cet arrivage.');
        $post(['quantity' => '1'], 'lost')->assertUnprocessable()->assertJsonPath('errors.exit_reason.0', 'Choisissez le motif de la sortie.');
        $post(['quantity' => '10', 'stock_lot_id' => $expired])->assertCreated()
            ->assertJsonPath('data.exit_reason', 'expired')->assertJsonPath('data.items.0.stock_lot_id', $expired);
        $post(['quantity' => '1'], 'damaged')->assertCreated();
        $post(['quantity' => '1'], 'consumed')->assertCreated();

        // L'arrivage périmé est vide ; les sorties sans arrivage visé prennent la date la plus proche.
        $this->assertSame([[$this->day(30), '4.000']], $this->lots($id));
        $dashboard = $this->api('kone', 'GET', $this->url('/dashboard?period=today'), as: $this->owner)->assertOk();
        // Périmé 10 × 300 + cassé 1 × 300 ; « consommé » n'est pas une perte.
        $dashboard->assertJsonPath('data.losses.total', '3300.00')->assertJsonPath('data.losses.by_reason.expired', '3000.00')
            ->assertJsonPath('data.losses.by_reason.damaged', '300.00')->assertJsonPath('data.losses.by_reason.stolen', '0.00');
        $this->assertLotsMatchStock();
    }

    public function test_a_purchase_whose_arrival_was_already_sold_cannot_be_cancelled(): void
    {
        $id = $this->yoghurt();
        $purchase = fn () => $this->api('kone', 'POST', $this->url('/purchases'), ['items' => [
            ['product_id' => $id, 'quantity' => '20', 'cost' => '300', 'expiry_date' => $this->day(10)],
            ['product_id' => $id, 'quantity' => '5', 'cost' => '300', 'expiry_date' => $this->day(40)],
        ]], as: $this->owner)->assertCreated();
        $first = $purchase()->assertJsonPath('data.items.0.expiry_date', $this->day(10))->json('data.id');
        $second = $purchase()->json('data.id');
        $this->assertSame([[$this->day(10), '20.000'], [$this->day(10), '20.000'], [$this->day(40), '5.000'], [$this->day(40), '5.000']], $this->lots($id));

        // La vente prend l'arrivage le plus ancien à date égale : celui du premier approvisionnement.
        $this->sell($id, '15');
        $this->api('kone', 'POST', $this->url("/purchases/{$first}/cancel"), ['reason' => 'Erreur'], as: $this->owner)->assertUnprocessable()
            ->assertJsonPath('errors.items.0', '15 u de Yaourt nature de cet approvisionnement sont déjà vendus ou sortis du stock. Corrigez plutôt le stock par un inventaire.');

        // Un approvisionnement intact s'annule normalement.
        $this->api('kone', 'POST', $this->url("/purchases/{$second}/cancel"), ['reason' => 'Doublon'], as: $this->owner)->assertOk();
        $this->assertSame([[$this->day(10), '5.000'], [$this->day(40), '5.000']], $this->lots($id));
        $this->assertLotsMatchStock();
    }

    public function test_tracking_can_start_on_a_product_that_already_has_stock(): void
    {
        $product = $this->api('kone', 'POST', '/products', ['name' => 'Lait 1 L', 'price' => '800', 'initial_quantity' => '12', 'shop_id' => $this->shop->id], as: $this->owner)
            ->assertJsonPath('data.track_expiry', false)->json('data');
        $this->assertSame([], $this->lots($product['id']));

        $this->api('kone', 'PUT', "/products/{$product['id']}", ['name' => 'Lait 1 L', 'price' => '800', 'track_expiry' => true, 'expiry_alert_days' => 3], as: $this->owner)
            ->assertOk()->assertJsonPath('data.track_expiry', true)->assertJsonPath('data.expiry_alert_days', 3);
        // Le stock déjà là devient un arrivage sans date ; sa date peut être renseignée ensuite.
        $this->assertSame([[null, '12.000']], $this->lots($product['id']));
        $lot = $this->lotIds($product['id'])[0];
        $this->api('kone', 'PUT', $this->url("/stock/lots/{$lot}"), ['expiry_date' => '2026-02-30'], as: $this->owner)
            ->assertUnprocessable()->assertJsonPath('errors.expiry_date.0', 'Cette date n’est pas valide.');
        $this->api('kone', 'PUT', $this->url("/stock/lots/{$lot}"), ['expiry_date' => $this->day(2)], as: $this->owner)
            ->assertOk()->assertJsonPath('data.state', 'soon');
        $this->assertTrue($this->tenant->run(fn () => DB::table('audit_logs')->where('action', 'stock.lot_dated')->exists()));
        $this->assertLotsMatchStock();
    }

    public function test_the_stock_list_the_till_and_the_dashboard_show_what_expires(): void
    {
        $expired = $this->yoghurt(initial: '3', expiry: $this->day(0), cost: '300');
        $soon = $this->yoghurt('Fromage', initial: '2', expiry: $this->day(5), cost: '1000');
        $this->yoghurt('Beurre', initial: '4', expiry: $this->day(60));

        $list = $this->api('kone', 'GET', $this->url('/stock'), as: $this->owner)->assertOk();
        $list->assertJsonPath('summary.expired', 1)->assertJsonPath('summary.soon', 1);
        $this->assertSame(['Yaourt nature'], array_column(array_column($this->api('kone', 'GET', $this->url('/stock?filter[expiry]=expired'), as: $this->owner)->json('data'), 'product'), 'name'));
        $this->assertSame(['Fromage'], array_column(array_column($this->api('kone', 'GET', $this->url('/stock?filter[expiry]=soon'), as: $this->owner)->json('data'), 'product'), 'name'));

        // À la caisse, même hors ligne : quantité périmée et depuis quand.
        $articles = collect($this->api('kone', 'GET', $this->url('/pos/bootstrap'), as: $this->owner)->json('data.products'))->keyBy('id');
        $this->assertSame('3.000', $articles[$expired]['expiry']['expired_quantity']);
        $this->assertSame($this->day(0), $articles[$expired]['expiry']['expired_since']);
        $this->assertSame('2.000', $articles[$soon]['expiry']['soon_quantity']);

        $this->api('kone', 'GET', $this->url('/dashboard?period=today'), as: $this->owner)->assertOk()
            ->assertJsonPath('data.expiry', ['expired' => 1, 'expired_value' => '900.00', 'soon' => 1, 'soon_value' => '2000.00']);
    }

    public function test_an_inventory_takes_the_nearest_dates_and_dates_what_it_adds(): void
    {
        $id = $this->yoghurt(initial: '10', expiry: $this->day(4));
        $this->entry($id, '10', $this->day(15));
        $count = fn (string $counted, ?string $expiry = null) => $this->api('kone', 'POST', $this->url('/adjustments'), [
            'kind' => 'inventory', 'reason' => 'Inventaire', 'items' => [['product_id' => $id, 'counted_quantity' => $counted, 'expiry_date' => $expiry]],
        ], as: $this->owner)->assertCreated();

        $count('16');
        $this->assertSame([[$this->day(15), '10.000'], [$this->day(4), '6.000']], $this->sortedByDate($id));
        $adjustment = $count('19', $this->day(25))->json('data.id');
        $this->assertSame([[$this->day(4), '6.000'], [$this->day(15), '10.000'], [$this->day(25), '3.000']], $this->lots($id));
        $this->api('kone', 'POST', $this->url("/adjustments/{$adjustment}/cancel"), ['reason' => 'Mauvais comptage'], as: $this->owner)->assertOk();
        $this->assertSame([[$this->day(4), '6.000'], [$this->day(15), '10.000']], $this->lots($id));
        $this->assertLotsMatchStock();
    }

    private function yoghurt(string $name = 'Yaourt nature', ?string $initial = null, ?string $expiry = null, ?string $cost = null): int
    {
        return $this->api('kone', 'POST', '/products', array_filter([
            'name' => $name, 'price' => '500', 'cost' => $cost, 'track_expiry' => true,
            'initial_quantity' => $initial, 'initial_expiry_date' => $expiry, 'shop_id' => $this->shop->id,
        ], fn ($v) => $v !== null), as: $this->owner)->assertCreated()->assertJsonPath('data.track_expiry', true)->json('data.id');
    }

    private function entry(int $id, string $quantity, ?string $expiry): void
    {
        $this->api('kone', 'POST', $this->url('/adjustments'), [
            'kind' => 'entry', 'reason' => 'Marchandise reçue', 'items' => [['product_id' => $id, 'quantity' => $quantity, 'expiry_date' => $expiry]],
        ], as: $this->owner)->assertCreated();
    }

    private function sell(int $id, string $quantity)
    {
        return $this->api('kone', 'POST', $this->url('/sales'), [
            'items' => [['product_id' => $id, 'quantity' => $quantity]],
            'payments' => [['payment_method_id' => $this->cash, 'amount' => (string) (500 * (float) $quantity), 'cash_given' => (string) (500 * (float) $quantity)]],
        ], as: $this->owner)->assertCreated();
    }

    /** Arrivages en stock, dans l'ordre de sortie : [date, quantité]. */
    private function lots(int $productId): array
    {
        return array_map(fn ($l) => [$l['expiry_date'], $l['quantity']],
            $this->api('kone', 'GET', $this->url("/stock/lots?product_id={$productId}"), as: $this->owner)->assertOk()->json('data'));
    }

    private function sortedByDate(int $productId): array
    {
        $lots = $this->lots($productId);
        usort($lots, fn ($a, $b) => [$b[0] === null, $b[0]] <=> [$a[0] === null, $a[0]]);

        return $lots;
    }

    private function lotIds(int $productId): array
    {
        return array_column($this->api('kone', 'GET', $this->url("/stock/lots?product_id={$productId}"), as: $this->owner)->json('data'), 'id');
    }

    private function day(int $offset): string
    {
        return now('Africa/Abidjan')->addDays($offset)->toDateString();
    }

    private function url(string $path): string
    {
        return "/shops/{$this->shop->id}{$path}";
    }

    /** La somme des arrivages égale le stock de chaque article suivi (§7.11). */
    private function assertLotsMatchStock(): void
    {
        $this->tenant->run(function () {
            $gaps = DB::select('SELECT s.product_id, s.quantity, coalesce(sum(l.quantity), 0) AS lots FROM shop_stock s
                JOIN products p ON p.id = s.product_id AND p.track_expiry
                LEFT JOIN stock_lots l ON l.shop_id = s.shop_id AND l.product_id = s.product_id AND l.product_variant_id IS NOT DISTINCT FROM s.product_variant_id
                GROUP BY s.id HAVING s.quantity <> coalesce(sum(l.quantity), 0)');
            $this->assertSame([], $gaps);
        });
    }
}
