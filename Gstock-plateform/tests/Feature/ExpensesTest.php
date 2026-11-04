<?php

namespace Tests\Feature;

use App\Domain\Identity\Models\User;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Shops\Models\Shop;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** Dépenses DP-N (M12). */
class ExpensesTest extends TestCase
{
    private Tenant $tenant;

    private Shop $shop;

    private User $owner;

    private int $cash;

    /** @var array<string, int> */
    private array $categories;

    protected function setUp(): void
    {
        parent::setUp();
        ['tenant' => $this->tenant, 'owner' => $this->owner, 'shop' => $this->shop] = $this->createTenant();
        [$this->cash, $this->categories] = $this->tenant->run(fn () => [
            DB::table('payment_methods')->where('type', 'cash')->value('id'),
            DB::table('expense_categories')->pluck('id', 'name')->all(),
        ]);
    }

    public function test_expenses_are_recorded_listed_by_category_and_cancelled_with_a_reason(): void
    {
        $this->spend('Loyer', '75000', 'Loyer d’octobre')->assertCreated()->assertJsonPath('data.reference', 'DP-1')
            ->assertJsonPath('data.category.name', 'Loyer')->assertJsonPath('data.amount', '75000.00')->assertJsonPath('data.method.name', 'Espèces');
        $this->spend('Transport', '3000');
        $taxi = $this->spend('Transport', '2500', 'Taxi')->json('data.id');

        $this->api('kone', 'GET', $this->url('/expenses'), as: $this->owner)->assertJsonPath('meta.total', 3)
            ->assertJsonPath('summary.total', '80500.00')->assertJsonPath('summary.by_category.0.category.name', 'Loyer')
            ->assertJsonPath('summary.by_category.1.total', '5500.00');

        $this->api('kone', 'POST', $this->url("/expenses/{$taxi}/cancel"), ['reason' => ''], as: $this->owner)
            ->assertJsonPath('errors.reason.0', 'Indiquez pourquoi vous annulez cette dépense.');
        $this->api('kone', 'POST', $this->url("/expenses/{$taxi}/cancel"), ['reason' => 'Saisie en double'], as: $this->owner)
            ->assertOk()->assertJsonPath('data.status', 'cancelled')->assertJsonPath('data.cancel_reason', 'Saisie en double');
        $this->api('kone', 'POST', $this->url("/expenses/{$taxi}/cancel"), ['reason' => 'Encore'], as: $this->owner)->assertStatus(409);
        $this->assertTrue($this->tenant->run(fn () => DB::table('audit_logs')->where('action', 'expense.cancelled')->exists()));

        // L'annulée reste visible, mais ne compte plus.
        $this->api('kone', 'GET', $this->url('/expenses?filter[expense_category_id]='.$this->categories['Transport']), as: $this->owner)
            ->assertJsonPath('meta.total', 2)->assertJsonPath('summary', ['count' => 1, 'total' => '3000.00', 'by_category' => [['category' => ['id' => $this->categories['Transport'], 'name' => 'Transport'], 'total' => '3000.00']]]);
        $this->api('kone', 'GET', $this->url('/expenses?search=octobre'), as: $this->owner)->assertJsonPath('meta.total', 1);
        $this->api('kone', 'GET', $this->url('/expenses?filter[from]='.urlencode(now()->addDay()->toIso8601String())), as: $this->owner)->assertJsonPath('meta.total', 0);
    }

    public function test_validation_idempotence_and_visibility(): void
    {
        $this->api('kone', 'POST', $this->url('/expenses'), ['amount' => '0', 'occurred_at' => now()->addDay()->toIso8601String()], as: $this->owner)
            ->assertUnprocessable()->assertJsonPath('errors.expense_category_id.0', 'Choisissez une catégorie.')
            ->assertJsonPath('errors.amount.0', 'Saisissez le montant de la dépense.')->assertJsonPath('errors.payment_method_id.0', 'Choisissez le mode de paiement.')
            ->assertJsonPath('errors.occurred_at.0', 'La date ne peut pas être dans le futur.');

        // Hors ligne : renvoyée deux fois, enregistrée une seule (ADR-005).
        $uuid = '5d7c1a90-2222-4b3c-8d9e-abcdefabcdef';
        $first = $this->spend('Électricité', '18500', null, $uuid)->assertCreated()->json('data.id');
        $this->spend('Électricité', '18500', null, $uuid)->assertOk()->assertJsonPath('data.id', $first);

        $seller = $this->createUser($this->tenant, ['expenses.view', 'expenses.create'], [$this->shop]);
        $this->api('kone', 'POST', $this->url('/expenses'), ['expense_category_id' => $this->categories['Transport'], 'amount' => '1000', 'payment_method_id' => $this->cash], as: $seller)->assertCreated();
        $this->api('kone', 'GET', $this->url('/expenses'), as: $seller)->assertJsonPath('meta.total', 1)->assertJsonPath('summary.total', '1000.00');
        $this->api('kone', 'POST', $this->url("/expenses/{$first}/cancel"), ['reason' => 'x'], as: $seller)->assertForbidden();
    }

    private function spend(string $category, string $amount, ?string $note = null, ?string $uuid = null)
    {
        return $this->api('kone', 'POST', $this->url('/expenses'), array_filter([
            'expense_category_id' => $this->categories[$category], 'amount' => $amount, 'payment_method_id' => $this->cash, 'note' => $note, 'offline_uuid' => $uuid,
        ]), as: $this->owner);
    }

    private function url(string $path): string
    {
        return "/shops/{$this->shop->id}{$path}";
    }
}
