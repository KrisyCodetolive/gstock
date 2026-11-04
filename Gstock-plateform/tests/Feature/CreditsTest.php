<?php

namespace Tests\Feature;

use App\Domain\Identity\Models\User;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Shops\Models\Shop;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** Mes crédits clients (M09) : paiements RB-N (§7.6), échéances (§7.7), avoirs et argent rendu (P3). */
class CreditsTest extends TestCase
{
    private Tenant $tenant;

    private Shop $shop;

    private User $owner;

    private int $customer;

    private int $cash;

    private int $rice;

    protected function setUp(): void
    {
        parent::setUp();
        ['tenant' => $this->tenant, 'owner' => $this->owner, 'shop' => $this->shop] = $this->createTenant();
        $this->customer = $this->api('kone', 'POST', '/customers', ['name' => 'Awa Koné', 'phone' => '0748219033'], as: $this->owner)->json('data.id');
        $this->cash = $this->tenant->run(fn () => DB::table('payment_methods')->where('type', 'cash')->value('id'));
        $this->rice = $this->api('kone', 'POST', '/products', ['name' => 'Riz', 'price' => '25000', 'initial_quantity' => '10', 'shop_id' => $this->shop->id], as: $this->owner)->json('data.id');
    }

    public function test_repayments_are_allocated_oldest_first_and_balances_follow(): void
    {
        $old = $this->opening('10000')->assertCreated()->assertJsonPath('data.reference', 'CR-1')->assertJsonPath('data.is_opening_balance', true)->json('data.id');
        $this->travel(1)->minutes();
        $sale = $this->creditSale()->json('data');

        // 10 000 (ancienne dette) + 25 000 (vente) ; un paiement de 12 000 solde d'abord la plus ancienne.
        $r = $this->repay('12000')->assertCreated()->assertJsonPath('data.reference', 'RB-1');
        $r->assertJsonPath('data.allocations.0.credit.id', $old)->assertJsonPath('data.allocations.0.amount', '10000.00')
            ->assertJsonPath('data.allocations.1.amount', '2000.00')->assertJsonPath('data.balance_after', '23000.00');
        $this->repay('5000')->assertJsonPath('data.balance_after', '18000.00');
        // 25 000 − 2 000 − 5 000 = 18 000 restent sur la vente (exemple du cahier).
        $this->api('kone', 'GET', "/customers/{$this->customer}/credits", as: $this->owner)
            ->assertJsonPath('data.totals', ['credit_total' => '35000.00', 'repaid_total' => '17000.00', 'balance' => '18000.00'])
            ->assertJsonPath('data.credits.0.status', 'partial')->assertJsonPath('data.credits.1.status', 'settled');
        $this->assertSame('18000.00', $this->api('kone', 'GET', "/customers/{$this->customer}", as: $this->owner)->json('data.balance'));
        $this->assertSame($sale['reference'], DB::table('customer_credits')->where('sale_id', $sale['id'])->value('reference'));
    }

    public function test_a_repayment_never_exceeds_the_debt_and_manual_allocations_must_match(): void
    {
        $a = $this->opening('3000')->json('data.id');
        $b = $this->opening('4000')->json('data.id');

        $this->repay('8000')->assertJsonPath('errors.amount.0', "Le client ne doit que 7\u{202F}000 FCFA dans cette boutique.");
        $this->repay('0')->assertJsonPath('errors.amount.0', 'Saisissez le montant reçu.');
        $this->repay('5000', ['allocations' => [['credit_id' => $a, 'amount' => '3000'], ['credit_id' => $b, 'amount' => '1000']]])
            ->assertJsonPath('errors.allocations.0', "Répartissez exactement 5\u{202F}000 FCFA (actuellement 4\u{202F}000 FCFA).");
        $this->repay('5000', ['allocations' => [['credit_id' => $a, 'amount' => '3500'], ['credit_id' => $b, 'amount' => '1500']]])
            ->assertJsonPath('errors.allocations.0', "Le crédit CR-1 n'a plus que 3\u{202F}000 FCFA à payer.");
        $this->repay('4000', ['allocations' => [['credit_id' => $b, 'amount' => '4000']]])->assertCreated();
        $this->assertSame('3000.00', $this->remaining($a));
        $this->assertSame('0.00', $this->remaining($b));
    }

    public function test_cancelling_a_repayment_frees_its_allocations(): void
    {
        $credit = $this->opening('10000')->json('data.id');
        $id = $this->repay('6000')->json('data.id');
        $this->api('kone', 'POST', $this->url("/repayments/{$id}/cancel"), ['reason' => ''], as: $this->owner)
            ->assertJsonPath('errors.reason.0', 'Indiquez pourquoi vous annulez ce paiement.');
        $this->api('kone', 'POST', $this->url("/repayments/{$id}/cancel"), ['reason' => 'Billet faux'], as: $this->owner)->assertOk()->assertJsonPath('data.status', 'cancelled');
        $this->assertSame('10000.00', $this->remaining($credit));
        $this->api('kone', 'POST', $this->url("/repayments/{$id}/cancel"), ['reason' => 'Encore'], as: $this->owner)->assertStatus(409);
    }

    public function test_p3_money_already_received_is_kept_as_a_credit_note_or_given_back(): void
    {
        $credit = $this->opening('10000')->json('data.id');
        $repayment = $this->repay('4000')->json('data.id');

        $this->api('kone', 'POST', $this->url("/credits/{$credit}/cancel"), ['reason' => 'Erreur'], as: $this->owner)
            ->assertJsonPath('errors.refund_mode.0', "Ce client a déjà payé 4\u{202F}000 FCFA sur ce crédit : choisissez de les garder en avoir ou de les lui rendre.");
        $this->api('kone', 'POST', $this->url("/credits/{$credit}/cancel"), ['reason' => 'Erreur', 'refund_mode' => 'credit_note'], as: $this->owner)
            ->assertOk()->assertJsonPath('data.status', 'cancelled')->assertJsonPath('data.cancel_settlement', ['mode' => 'credit_note', 'amount' => '4000.00']);
        $this->api('kone', 'GET', "/customers/{$this->customer}", as: $this->owner)->assertJsonPath('data.credit_note_balance', '4000.00')->assertJsonPath('data.balance', '0.00');
        // Le paiement a servi à une annulation réglée : il ne s'annule plus.
        $this->api('kone', 'POST', $this->url("/repayments/{$repayment}/cancel"), ['reason' => 'x'], as: $this->owner)->assertStatus(409);

        // L'avoir paie une partie d'un achat à la caisse.
        $this->api('kone', 'POST', $this->url('/sales'), ['customer_id' => $this->customer, 'items' => [['product_id' => $this->rice, 'quantity' => '1']],
            'payments' => [['payment_method_id' => null, 'credit_note' => true, 'amount' => '5000']]], as: $this->owner)
            ->assertJsonPath('errors.payments.0', "L'avoir du client n'est que de 4\u{202F}000 FCFA.");
        $sale = $this->api('kone', 'POST', $this->url('/sales'), ['customer_id' => $this->customer, 'items' => [['product_id' => $this->rice, 'quantity' => '1']],
            'payments' => [['payment_method_id' => null, 'credit_note' => true, 'amount' => '4000'], ['payment_method_id' => $this->cash, 'amount' => '21000']]], as: $this->owner)
            ->assertCreated()->assertJsonPath('data.payments.0.method', null)->json('data.id');
        $this->api('kone', 'GET', "/customers/{$this->customer}", as: $this->owner)->assertJsonPath('data.credit_note_balance', '0.00');
        // Vente annulée : l'avoir utilisé revient au client.
        $this->api('kone', 'POST', $this->url("/sales/{$sale}/cancel"), ['reason' => 'Retour'], as: $this->owner)->assertOk();
        $this->api('kone', 'GET', "/customers/{$this->customer}", as: $this->owner)->assertJsonPath('data.credit_note_balance', '4000.00');

        // Rendre l'argent : une sortie d'argent enregistrée, sans avoir.
        $other = $this->opening('2000')->json('data.id');
        $this->repay('2000');
        $this->api('kone', 'POST', $this->url("/credits/{$other}/cancel"), ['reason' => 'Doublon', 'refund_mode' => 'refund'], as: $this->owner)
            ->assertJsonPath('errors.refund_payment_method_id.0', "Choisissez comment l'argent est rendu.");
        $this->api('kone', 'POST', $this->url("/credits/{$other}/cancel"), ['reason' => 'Doublon', 'refund_mode' => 'refund', 'refund_payment_method_id' => $this->cash], as: $this->owner)->assertOk();
        $this->api('kone', 'GET', "/customers/{$this->customer}/credits", as: $this->owner)
            ->assertJsonPath('data.refunds.0.amount', '2000.00')->assertJsonPath('data.credit_note_balance', '4000.00');
    }

    public function test_a_sale_whose_credit_was_partly_paid_asks_the_p3_choice(): void
    {
        $sale = $this->creditSale()->json('data.id');
        $this->repay('5000');

        $this->api('kone', 'POST', $this->url("/sales/{$sale}/cancel"), ['reason' => 'Erreur'], as: $this->owner)->assertUnprocessable()->assertJsonPath('errors.refund_mode.0', fn ($m) => str_contains($m, '5'));
        $this->api('kone', 'POST', $this->url("/sales/{$sale}/cancel"), ['reason' => 'Erreur', 'refund_mode' => 'credit_note'], as: $this->owner)
            ->assertOk()->assertJsonPath('data.credit.status', 'cancelled');
        $this->api('kone', 'GET', "/customers/{$this->customer}", as: $this->owner)->assertJsonPath('data.credit_note_balance', '5000.00');
        $this->assertSame('10.000', (string) DB::table('shop_stock')->where('product_id', $this->rice)->where('shop_id', $this->shop->id)->value('quantity'));
    }

    public function test_adjustments_are_bounded_and_journaled(): void
    {
        $credit = $this->opening('10000')->json('data.id');
        $this->repay('2000');

        $this->adjust($credit, '9000', 'Geste')->assertJsonPath('errors.amount.0', "Le reste ne peut pas devenir négatif : il est de 8\u{202F}000 FCFA.");
        $this->adjust($credit, '-1000', 'Erreur')->assertJsonPath('errors.amount.0', 'Le reste ne peut pas dépasser le montant du crédit.');
        $this->adjust($credit, '500', '')->assertJsonPath('errors.reason.0', 'Indiquez le motif de la régularisation.');
        $this->adjust($credit, '1500', 'Geste commercial')->assertOk()
            ->assertJsonPath('data.remaining_amount', '6500.00')->assertJsonPath('data.adjusted_amount', '1500.00')->assertJsonPath('data.adjustments.0.reason', 'Geste commercial');
        $this->assertTrue(DB::table('audit_logs')->where('action', 'credit.adjusted')->exists());
    }

    public function test_installments_follow_payments_and_show_what_is_overdue(): void
    {
        $credit = $this->opening('10000')->json('data.id');
        $put = fn (array $items) => $this->api('kone', 'PUT', $this->url("/credits/{$credit}/installments"), ['installments' => $items], as: $this->owner);

        $put([['due_date' => now()->subDays(3)->toDateString(), 'amount' => '4000'], ['due_date' => now()->addDays(5)->toDateString(), 'amount' => '5000']])
            ->assertJsonPath('errors.installments.0', "Le total des échéances doit être égal au reste : 10\u{202F}000 FCFA (actuellement 9\u{202F}000 FCFA).");
        $put([['due_date' => now()->subDays(3)->toDateString(), 'amount' => '4000'], ['due_date' => now()->addDays(5)->toDateString(), 'amount' => '6000']])->assertOk()
            ->assertJsonPath('data.installments.0.status', 'overdue')->assertJsonPath('data.installments.1.status', 'pending');
        $this->api('kone', 'GET', $this->url('/installments?status=overdue'), as: $this->owner)->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.customer.name', 'Awa Koné');
        $this->api('kone', 'GET', $this->url('/installments?status=upcoming'), as: $this->owner)->assertJsonPath('meta.total', 1);
        $this->api('kone', 'GET', $this->url('/credits/summary'), as: $this->owner)->assertJsonPath('data.overdue_installments', ['count' => 1, 'amount' => '4000.00']);

        $this->repay('5000');
        $this->api('kone', 'GET', $this->url("/credits/{$credit}/installments"), as: $this->owner)
            ->assertJsonPath('data.0.status', 'paid')->assertJsonPath('data.1.status', 'partial')->assertJsonPath('data.1.paid_amount', '1000.00');
    }

    public function test_summary_debtors_permissions_and_receipts(): void
    {
        $this->opening('7500');
        $this->creditSale();
        $id = $this->repay('2500')->json('data.id');

        $this->api('kone', 'GET', $this->url('/credits/summary'), as: $this->owner)
            ->assertJsonPath('data.remaining_total', '30000.00')->assertJsonPath('data.debtors_count', 1)
            ->assertJsonPath('data.new_credits', ['count' => 1, 'amount' => '25000.00'])->assertJsonPath('data.repayments', ['count' => 1, 'amount' => '2500.00']);
        $this->api('kone', 'GET', $this->url('/credits/debtors'), as: $this->owner)
            ->assertJsonPath('data.0.balance', '30000.00')->assertJsonPath('data.0.repaid_total', '2500.00')->assertJsonPath('data.0.open_credits', 2);

        $cashier = $this->createUser($this->tenant, ['credits.view'], [$this->shop]);
        $this->api('kone', 'POST', $this->url('/repayments'), ['customer_id' => $this->customer, 'amount' => '100', 'payment_method_id' => $this->cash], as: $cashier)->assertForbidden();
        $this->api('kone', 'POST', $this->url('/credits/opening-balance'), ['customer_id' => $this->customer, 'amount' => '100'], as: $cashier)->assertForbidden();

        $link = $this->api('kone', 'POST', $this->url("/repayments/{$id}/share-link"), as: $this->owner)->json('data');
        $this->assertStringContainsString('Reste à payer : 30', $link['message']);
        $this->app['auth']->forgetGuards();
        $token = substr($link['url'], strrpos($link['url'], '/') + 1);
        $this->api('kone', 'GET', "/public/receipts/{$token}")->assertOk()->assertJsonPath('data.kind', 'repayment')->assertJsonPath('data.repayment.reference', 'RB-1');
    }

    public function test_offline_repayments_are_idempotent(): void
    {
        $this->opening('5000');
        $extra = ['offline_uuid' => '9b2f1c2e-1111-4a3b-9c8d-123456789abc'];
        $first = $this->repay('1000', $extra)->assertCreated()->json('data.id');
        $this->repay('1000', $extra)->assertOk()->assertJsonPath('data.id', $first);
        $this->assertSame(1, DB::table('credit_repayments')->count());
    }

    private function opening(string $amount)
    {
        return $this->api('kone', 'POST', $this->url('/credits/opening-balance'), ['customer_id' => $this->customer, 'amount' => $amount], as: $this->owner);
    }

    private function creditSale()
    {
        return $this->api('kone', 'POST', $this->url('/sales'), ['customer_id' => $this->customer, 'items' => [['product_id' => $this->rice, 'quantity' => '1']], 'payments' => []], as: $this->owner);
    }

    private function repay(string $amount, array $extra = [])
    {
        return $this->api('kone', 'POST', $this->url('/repayments'), ['customer_id' => $this->customer, 'amount' => $amount, 'payment_method_id' => $this->cash, ...$extra], as: $this->owner);
    }

    private function adjust(int $credit, string $amount, string $reason)
    {
        return $this->api('kone', 'POST', $this->url("/credits/{$credit}/adjustments"), ['amount' => $amount, 'reason' => $reason], as: $this->owner);
    }

    private function remaining(int $credit): string
    {
        return (string) DB::table('customer_credits')->where('id', $credit)->value('remaining_amount');
    }

    private function url(string $path): string
    {
        return "/shops/{$this->shop->id}{$path}";
    }
}
