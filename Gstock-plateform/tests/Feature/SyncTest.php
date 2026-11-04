<?php

namespace Tests\Feature;

use App\Domain\Identity\Models\User;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Shops\Models\Shop;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/** Synchronisation des opérations faites hors ligne (ADR-005, P2). */
class SyncTest extends TestCase
{
    private Tenant $tenant;

    private Shop $shop;

    private User $owner;

    private int $cash;

    private int $mobile;

    private int $customer;

    private int $oil;

    protected function setUp(): void
    {
        parent::setUp();
        ['tenant' => $this->tenant, 'owner' => $this->owner, 'shop' => $this->shop] = $this->createTenant();
        [$this->cash, $this->mobile] = $this->tenant->run(fn () => [
            DB::table('payment_methods')->where('type', 'cash')->value('id'),
            DB::table('payment_methods')->where('type', 'mobile_money')->value('id'),
        ]);
        $this->customer = $this->api('kone', 'POST', '/customers', ['name' => 'Awa Koné'], as: $this->owner)->json('data.id');
        $this->oil = $this->api('kone', 'POST', '/products', ['name' => 'Huile 1 L', 'price' => '1500', 'initial_quantity' => '10', 'shop_id' => $this->shop->id], as: $this->owner)->json('data.id');
    }

    public function test_offline_operations_get_their_final_references_and_are_never_recorded_twice(): void
    {
        $this->api('kone', 'POST', $this->url('/credits/opening-balance'), ['customer_id' => $this->customer, 'amount' => '5000'], as: $this->owner)->assertCreated();
        $category = $this->tenant->run(fn () => DB::table('expense_categories')->where('name', 'Transport')->value('id'));
        $ops = [
            $this->sale(2, [['payment_method_id' => $this->cash, 'amount' => '3000', 'cash_given' => '5000']], at: now()->subHours(3)),
            $this->op('repayment', ['customer_id' => $this->customer, 'amount' => '2000', 'payment_method_id' => $this->cash], now()->subHours(2)),
            $this->op('expense', ['expense_category_id' => $category, 'amount' => '1500', 'payment_method_id' => $this->cash, 'note' => 'Taxi'], now()->subHour()),
        ];

        $first = $this->sync($ops)->assertOk();
        $first->assertJsonPath('data.0.status', 'created')->assertJsonPath('data.0.resource.reference', 'V-1')
            ->assertJsonPath('data.1.status', 'created')->assertJsonPath('data.1.resource.reference', 'RB-1')
            ->assertJsonPath('data.2.status', 'created')->assertJsonPath('data.2.resource.reference', 'DP-1')
            ->assertJsonPath('data.2.type', 'expense')->assertJsonPath('data.2.offline_uuid', $ops[2]['offline_uuid']);
        // L'heure de l'appareil est gardée.
        $this->api('kone', 'GET', $this->url('/sales/'.$first->json('data.0.resource.id')), as: $this->owner)
            ->assertJsonPath('data.occurred_at', $ops[0]['occurred_at'])->assertJsonPath('data.sync_status', 'ok');
        $this->assertSame('8.000', $this->stock());

        // Renvoyées (réseau coupé avant la réponse) : rien n'est enregistré deux fois.
        $this->sync($ops)->assertJsonPath('data.*.status', ['duplicate', 'duplicate', 'duplicate'])
            ->assertJsonPath('data.0.resource.reference', 'V-1')->assertJsonPath('data.1.resource.reference', 'RB-1');
        $this->assertSame('8.000', $this->stock());
        $this->assertSame(1, $this->tenant->run(fn () => DB::table('expenses')->count()));
        $this->api('kone', 'GET', "/customers/{$this->customer}", as: $this->owner)->assertJsonPath('data.balance', '3000.00');
    }

    public function test_a_conflict_is_recorded_to_review_and_stock_never_goes_negative(): void
    {
        // Pendant la coupure, une autre caisse a vendu 8 huiles et le prix est passé à 1 500.
        $this->api('kone', 'POST', $this->url('/sales'), ['items' => [['product_id' => $this->oil, 'quantity' => '8']], 'payments' => [['payment_method_id' => $this->cash, 'amount' => '12000']]], as: $this->owner)->assertCreated();
        $op = $this->sale(3, [['payment_method_id' => $this->cash, 'amount' => '3600']], price: '1200');

        $r = $this->sync([$op])->assertJsonPath('data.0.status', 'to_review');
        $this->assertSame([
            'Prix de Huile 1 L : 1 200 FCFA sur l’appareil, 1 500 FCFA aujourd’hui.',
            'Stock insuffisant pour Huile 1 L : 3 u vendus, 2 u en stock à la synchronisation. Faites un inventaire.',
        ], array_map(fn ($s) => str_replace(["\u{202F}", "\u{00A0}", "'"], [' ', ' ', '’'], $s), $r->json('data.0.reasons')));
        $this->assertSame('0.000', $this->stock());
        // La vente garde le prix de l'appareil et l'argent réellement reçu.
        $this->api('kone', 'GET', $this->url('/sales?filter[sync_status]=to_review'), as: $this->owner)
            ->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.total', '3600.00');
    }

    public function test_refused_operations_stay_on_the_device_without_blocking_the_others(): void
    {
        $this->api('kone', 'POST', $this->url('/credits/opening-balance'), ['customer_id' => $this->customer, 'amount' => '5000'], as: $this->owner)->assertCreated();
        $inactive = $this->api('kone', 'POST', '/customers', ['name' => 'Moussa'], as: $this->owner)->json('data.id');
        $this->api('kone', 'PUT', "/customers/{$inactive}", ['name' => 'Moussa', 'is_active' => false], as: $this->owner)->assertOk();
        $this->tenant->run(fn () => DB::table('tenant_payment_settings')->update(['is_active' => true]));

        $r = $this->sync([
            $this->op('repayment', ['customer_id' => $this->customer, 'amount' => '1000', 'payment_method_id' => $this->mobile]),
            $this->sale(1, [['payment_method_id' => $this->mobile, 'amount' => '1500']]),
            $this->sale(1, [], customer: $inactive),
            ['type' => 'sale', 'offline_uuid' => 'pas-un-uuid', 'occurred_at' => now()->toIso8601String(), 'payload' => []],
            $this->sale(1, [['payment_method_id' => $this->cash, 'amount' => '1500']]),
        ]);
        $r->assertJsonPath('data.*.status', ['rejected', 'rejected', 'rejected', 'rejected', 'created'])
            ->assertJsonPath('data.0.message', 'Hors ligne, seuls les paiements en espèces sont acceptés.')
            ->assertJsonPath('data.1.message', 'Hors ligne, les paiements GeniusPay ne sont pas possibles : encaissez en espèces.')
            ->assertJsonPath('data.3.message', 'Opération illisible : elle ne peut pas être enregistrée.')
            ->assertJsonPath('data.4.resource.reference', 'V-1');
        $this->assertNotNull($r->json('data.2.message'));
        $this->assertNull($r->json('data.2.resource'));

        // Droit retiré entre-temps : refusée, avec un message clair.
        $cashier = $this->createUser($this->tenant, ['sales.create'], [$this->shop]);
        $this->sync([$this->op('expense', ['amount' => '500'])], as: $cashier)
            ->assertJsonPath('data.0.status', 'rejected')->assertJsonPath('data.0.message', "Vous n'avez plus le droit d'enregistrer cette opération.");
    }

    public function test_device_clock_access_and_limits(): void
    {
        // Horloge de l'appareil en avance : ramenée à l'heure de réception.
        $id = $this->sync([$this->sale(1, [['payment_method_id' => $this->cash, 'amount' => '1500']], at: now()->addDays(2))])->json('data.0.resource.id');
        $at = $this->tenant->run(fn () => DB::table('sales')->where('id', $id)->value('occurred_at'));
        $this->assertTrue(now()->parse($at)->lessThanOrEqualTo(now()));

        $this->sync([], as: $this->createUser($this->tenant, ['products.view'], [$this->shop]))->assertForbidden();
        $other = $this->api('kone', 'POST', '/shops', ['name' => 'Autre', 'city' => 'Abidjan'], as: $this->owner)->json('data.id');
        $this->api('kone', 'POST', "/shops/{$other}/sync", ['operations' => []], as: $this->createUser($this->tenant, ['sales.create'], [$this->shop]))->assertForbidden();
        $this->sync(array_fill(0, 201, $this->sale(1, [])))->assertUnprocessable()->assertJsonPath('errors.operations.0', 'Envoyez au plus 200 opérations à la fois.');

        // Espace suspendu : lecture seule, les opérations restent sur l'appareil.
        $this->tenant->subscription->update(['ends_at' => now()->subDays(30), 'trial_ends_at' => now()->subDays(60)]);
        $this->sync([$this->sale(1, [['payment_method_id' => $this->cash, 'amount' => '1500']])])->assertStatus(402);
    }

    private function sale(int $quantity, array $payments, ?string $price = null, ?int $customer = null, $at = null): array
    {
        $item = ['product_id' => $this->oil, 'quantity' => (string) $quantity, ...($price ? ['price' => $price] : [])];

        return $this->op('sale', ['items' => [$item], 'payments' => $payments, 'customer_id' => $customer], $at);
    }

    private function op(string $type, array $payload, $at = null): array
    {
        return ['type' => $type, 'offline_uuid' => (string) Str::uuid(), 'occurred_at' => ($at ?? now())->toIso8601String(), 'payload' => $payload];
    }

    private function sync(array $operations, ?User $as = null): TestResponse
    {
        return $this->api('kone', 'POST', $this->url('/sync'), ['operations' => $operations], as: $as ?? $this->owner);
    }

    private function stock(): string
    {
        return (string) $this->tenant->run(fn () => DB::table('shop_stock')->where('shop_id', $this->shop->id)->where('product_id', $this->oil)->value('quantity'));
    }

    private function url(string $path): string
    {
        return "/shops/{$this->shop->id}{$path}";
    }
}
