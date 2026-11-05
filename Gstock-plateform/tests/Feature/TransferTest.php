<?php

namespace Tests\Feature;

use App\Domain\Identity\Models\User;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Shops\Models\Shop;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Transferts entre boutiques (§7.12) : le stock sort à l'envoi, entre à la réception
 * pour la quantité reçue, le manque compte en pertes ; annulation seulement avant la
 * réception ; dates de péremption et prix d'achat conservés ; permission stock.transfer.
 */
class TransferTest extends TestCase
{
    private Tenant $tenant;

    private Shop $cocody;

    private Shop $yopougon;

    private User $owner;

    private int $rice;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(now()->setTime(12, 0));
        ['tenant' => $this->tenant, 'owner' => $this->owner, 'shop' => $this->cocody] = $this->createTenant();
        $other = $this->api('kone', 'POST', '/shops', ['name' => 'Boutique Yopougon', 'city' => 'Abidjan'], as: $this->owner)->json('data.id');
        $this->yopougon = $this->tenant->run(fn () => Shop::query()->findOrFail($other));
        $this->rice = $this->api('kone', 'POST', '/products', ['name' => 'Riz 5 kg', 'price' => '4500', 'cost' => '3900', 'initial_quantity' => '10', 'shop_id' => $this->cocody->id], as: $this->owner)->json('data.id');
    }

    public function test_the_stock_leaves_at_sending_and_arrives_at_reception(): void
    {
        $sent = $this->send(['items' => [['product_id' => $this->rice, 'quantity' => '6']], 'note' => 'Pour le week-end'])
            ->assertCreated()->assertJsonPath('data.reference', 'TR-1')->assertJsonPath('data.status', 'in_transit')->assertJsonPath('data.direction', 'out');
        $id = $sent->json('data.id');
        // En route : compté nulle part.
        $this->assertSame(['4.000', '0.000'], [$this->stock($this->cocody), $this->stock($this->yopougon)]);
        $this->api('kone', 'GET', "/shops/{$this->yopougon->id}/transfers?direction=in", as: $this->owner)
            ->assertJsonPath('summary.to_receive', 1)->assertJsonPath('data.0.direction', 'in');
        $this->api('kone', 'GET', "/shops/{$this->yopougon->id}/dashboard", as: $this->owner)->assertJsonPath('data.transfers.to_receive', 1);

        // Réception avec un manque : 5 reçus sur 6.
        $this->api('kone', 'POST', "/shops/{$this->yopougon->id}/transfers/{$id}/receive", ['items' => [['product_id' => $this->rice, 'received_quantity' => '7']]], as: $this->owner)
            ->assertUnprocessable()->assertJsonPath('errors.items.0', 'Pour Riz 5 kg, la quantité reçue ne peut pas dépasser la quantité envoyée (6).');
        $this->api('kone', 'POST', "/shops/{$this->yopougon->id}/transfers/{$id}/receive", ['items' => [['product_id' => $this->rice, 'received_quantity' => '5']]], as: $this->owner)
            ->assertOk()->assertJsonPath('data.status', 'received')->assertJsonPath('data.items.0.missing_quantity', '1.000')->assertJsonPath('data.missing_value', '3900.00');
        $this->assertSame(['4.000', '5.000'], [$this->stock($this->cocody), $this->stock($this->yopougon)]);
        // Le manque est une perte de la boutique d'arrivée.
        $this->api('kone', 'GET', "/shops/{$this->yopougon->id}/dashboard", as: $this->owner)
            ->assertJsonPath('data.losses.by_reason.transfer', '3900.00')->assertJsonPath('data.transfers.to_receive', 0);

        // Une fois reçu, plus d'annulation ni de seconde réception.
        $this->api('kone', 'POST', "/shops/{$this->cocody->id}/transfers/{$id}/cancel", ['reason' => 'Erreur'], as: $this->owner)->assertStatus(409);
        $this->api('kone', 'POST', "/shops/{$this->yopougon->id}/transfers/{$id}/receive", [], as: $this->owner)->assertStatus(409);
        $this->assertStockMatchesMovements();
    }

    public function test_a_transfer_in_transit_can_be_cancelled_by_the_sending_shop(): void
    {
        $id = $this->send(['items' => [['product_id' => $this->rice, 'quantity' => '4']]])->json('data.id');
        $this->api('kone', 'POST', "/shops/{$this->yopougon->id}/transfers/{$id}/cancel", ['reason' => 'Erreur'], as: $this->owner)->assertForbidden();
        $this->api('kone', 'POST', "/shops/{$this->cocody->id}/transfers/{$id}/cancel", ['reason' => ''], as: $this->owner)
            ->assertUnprocessable()->assertJsonPath('errors.reason.0', 'Indiquez pourquoi vous annulez ce transfert.');
        $this->api('kone', 'POST', "/shops/{$this->cocody->id}/transfers/{$id}/cancel", ['reason' => 'Mauvaise boutique'], as: $this->owner)
            ->assertOk()->assertJsonPath('data.status', 'cancelled');
        $this->assertSame(['10.000', '0.000'], [$this->stock($this->cocody), $this->stock($this->yopougon)]);
        $this->api('kone', 'POST', "/shops/{$this->yopougon->id}/transfers/{$id}/receive", [], as: $this->owner)->assertStatus(409);
        $this->assertStockMatchesMovements();
    }

    public function test_sending_needs_the_transfer_permission_and_enough_stock(): void
    {
        $this->send(['items' => [['product_id' => $this->rice, 'quantity' => '11']]])->assertUnprocessable()
            ->assertJsonPath('errors.items.0', 'Stock insuffisant : il reste 10 u de Riz 5 kg.');
        $this->send(['to_shop_id' => $this->cocody->id, 'items' => [['product_id' => $this->rice, 'quantity' => '1']]])->assertUnprocessable()
            ->assertJsonPath('errors.to_shop_id.0', 'Choisissez une autre boutique que celle de départ.');

        // Sans stock.transfer : refusé ; avec, un rôle choisi par le propriétaire peut envoyer.
        $manager = $this->createUser($this->tenant, ['stock.view', 'stock.entry'], [$this->cocody]);
        $this->send(['items' => [['product_id' => $this->rice, 'quantity' => '1']]], $manager)->assertForbidden();
        $sender = $this->createUser($this->tenant, ['stock.view', 'stock.transfer'], [$this->cocody]);
        $id = $this->send(['items' => [['product_id' => $this->rice, 'quantity' => '1']]], $sender)->assertCreated()->json('data.id');

        // Réception : une personne de la boutique d'arrivée, avec « Ajouter du stock ».
        $this->api('kone', 'POST', "/shops/{$this->yopougon->id}/transfers/{$id}/receive", [], as: $sender)->assertForbidden();
        $receiver = $this->createUser($this->tenant, ['stock.view', 'stock.entry'], [$this->yopougon]);
        $this->api('kone', 'POST', "/shops/{$this->yopougon->id}/transfers/{$id}/receive", [], as: $receiver)->assertOk()
            ->assertJsonPath('data.items.0.received_quantity', '1.000');
        $this->assertTrue($this->tenant->run(fn () => DB::table('audit_logs')->whereIn('action', ['transfer.sent', 'transfer.received'])->count() === 2));
    }

    public function test_expiry_dates_and_purchase_cost_follow_the_goods(): void
    {
        $day = fn (int $n) => now('Africa/Abidjan')->addDays($n)->toDateString();
        $milk = $this->api('kone', 'POST', '/products', [
            'name' => 'Lait 1 L', 'price' => '800', 'cost' => '600', 'track_expiry' => true,
            'initial_quantity' => '5', 'initial_expiry_date' => $day(3), 'shop_id' => $this->cocody->id,
        ], as: $this->owner)->json('data.id');
        $this->api('kone', 'POST', "/shops/{$this->cocody->id}/adjustments", [
            'kind' => 'entry', 'reason' => 'Reçu', 'items' => [['product_id' => $milk, 'quantity' => '10', 'expiry_date' => $day(20)]],
        ], as: $this->owner)->assertCreated();

        // Part des dates les plus proches : 5 au jour +3, 3 au jour +20.
        $id = $this->send(['items' => [['product_id' => $milk, 'quantity' => '8']]])->json('data.id');
        $this->assertSame([[$day(20), '7.000']], $this->lots($this->cocody, $milk));
        // Reçu 7 sur 8 : le manque est pris sur la date la plus lointaine.
        $this->api('kone', 'POST', "/shops/{$this->yopougon->id}/transfers/{$id}/receive", ['items' => [['product_id' => $milk, 'received_quantity' => '7']]], as: $this->owner)->assertOk();
        $this->assertSame([[$day(3), '5.000'], [$day(20), '2.000']], $this->lots($this->yopougon, $milk));
        $this->assertSame('4200.00', $this->api('kone', 'GET', "/shops/{$this->yopougon->id}/stock?search=Lait", as: $this->owner)->json('data.0.value'));
        $this->assertStockMatchesMovements();
    }

    private function send(array $body, ?User $as = null)
    {
        return $this->api('kone', 'POST', "/shops/{$this->cocody->id}/transfers", ['to_shop_id' => $this->yopougon->id, ...$body], as: $as ?? $this->owner);
    }

    private function stock(Shop $shop): string
    {
        return (string) $this->tenant->run(fn () => DB::table('shop_stock')->where('shop_id', $shop->id)->where('product_id', $this->rice)->value('quantity'));
    }

    private function lots(Shop $shop, int $productId): array
    {
        return array_map(fn ($l) => [$l['expiry_date'], $l['quantity']],
            $this->api('kone', 'GET', "/shops/{$shop->id}/stock/lots?product_id={$productId}", as: $this->owner)->json('data'));
    }

    private function assertStockMatchesMovements(): void
    {
        $gaps = DB::select('select s.id from shop_stock s where s.tenant_id = ? and s.quantity <> coalesce((select sum(m.quantity) from stock_movements m
            where m.shop_id = s.shop_id and m.product_id = s.product_id and m.product_variant_id is not distinct from s.product_variant_id), 0)', [$this->tenant->id]);
        $this->assertSame([], $gaps);
    }
}
