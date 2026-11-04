<?php

namespace Tests\Feature;

use App\Domain\Platform\Admin\InvoiceReminder;
use App\Domain\Platform\Admin\PlatformAdministration;
use App\Domain\Platform\Admin\PlatformMetrics;
use App\Domain\Platform\Models\Plan;
use App\Domain\Platform\Models\PlatformAdmin;
use App\Domain\Platform\Models\PlatformAuditLog;
use App\Domain\Platform\Models\TenantInvoice;
use App\Filament\Resources\Plans\Pages\EditPlan;
use App\Filament\Resources\TenantInvoices\Pages\ListTenantInvoices;
use App\Filament\Resources\Tenants\Pages\ListTenants;
use App\Filament\Resources\Tenants\Pages\ViewTenant;
use App\Filament\Resources\Users\Pages\ListUsers;
use App\Filament\Widgets\PlatformStats;
use App\Filament\Widgets\SalesByTenant;
use Filament\Actions\Testing\TestAction;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Livewire\Livewire;
use Tests\TestCase;

/** Back-office de Genius Groups (M01, ADR-010). */
class BackOfficeTest extends TestCase
{
    private PlatformAdmin $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = PlatformAdmin::create(['name' => 'Équipe GStock', 'email' => 'admin@gstock.app', 'password' => 'motdepasse-solide', 'is_active' => true]);
    }

    public function test_only_an_active_platform_admin_gets_in(): void
    {
        ['owner' => $owner] = $this->createTenant();
        $this->get('http://'.self::DOMAIN.'/admin')->assertRedirect();
        // Un utilisateur d'espace n'est pas un super-admin (garde séparée).
        $this->actingAs($owner, 'web')->get('http://'.self::DOMAIN.'/admin')->assertRedirect();
        $this->actingAs(PlatformAdmin::create(['name' => 'Ancien', 'email' => 'old@gstock.app', 'password' => 'x', 'is_active' => false]), 'platform')
            ->get('http://'.self::DOMAIN.'/admin')->assertForbidden();

        $this->actingAs($this->admin, 'platform');
        $this->get('http://'.self::DOMAIN.'/admin')->assertOk()->assertSee('GStock — Back-office');
        // Les widgets du tableau de bord se chargent après la page.
        Livewire::test(PlatformStats::class)->assertSee('Espaces inscrits')->assertSee('Conversion essai → payant')->assertSee('Revenus du mois');
        Livewire::test(SalesByTenant::class)->assertSee('Kone');
        foreach (['espaces', 'boutiques', 'utilisateurs', 'formules', 'factures', 'journal'] as $page) {
            $this->get('http://'.self::DOMAIN.'/admin/'.$page)->assertOk();
        }
    }

    public function test_suspension_and_subscription_actions_are_journaled_with_their_reason(): void
    {
        ['tenant' => $tenant, 'owner' => $owner] = $this->createTenant();
        $this->actingAs($this->admin, 'platform');
        $page = fn () => Livewire::test(ViewTenant::class, ['record' => $tenant->getRouteKey()]);

        $page()->callAction('suspend', data: ['reason' => ''])->assertHasActionErrors(['reason' => 'required']);
        $page()->callAction('suspend', data: ['reason' => 'Fraude signalée'])->assertHasNoActionErrors();
        $this->assertNotNull($tenant->fresh()->suspended_at);
        // L'espace passe en lecture seule même si l'abonnement est payé.
        $this->api('kone', 'POST', '/products', ['name' => 'Riz', 'price' => '1000'], as: $owner)->assertStatus(402);
        $this->api('kone', 'GET', '/me', as: $owner)->assertJsonPath('data.tenant.subscription.tenant_status', 'suspended')->assertJsonPath('data.tenant.subscription.status', 'active');

        $page()->callAction('reactivate', data: ['reason' => 'Vérifié'])->assertHasNoActionErrors();
        $this->api('kone', 'POST', '/products', ['name' => 'Riz', 'price' => '1000'], as: $owner)->assertCreated();

        $trialEnd = $tenant->subscription->trial_ends_at;
        $page()->callAction('extendTrial', data: ['days' => 7, 'reason' => 'Formation en cours'])->assertHasNoActionErrors();
        $this->assertSame($trialEnd->copy()->addDays(7)->toDateString(), $tenant->subscription->fresh()->trial_ends_at->toDateString());
        $reseau = Plan::query()->where('name', 'Réseau')->value('id');
        $page()->callAction('changePlan', data: ['plan_id' => $reseau, 'reason' => 'Geste commercial'])->assertHasNoActionErrors();
        $this->assertSame('Réseau', $tenant->subscription->fresh()->plan->name);

        $this->assertSame(
            ['tenant.suspended' => 'Fraude signalée', 'tenant.reactivated' => 'Vérifié', 'tenant.trial_extended' => 'Formation en cours', 'tenant.plan_changed' => 'Geste commercial'],
            PlatformAuditLog::query()->orderBy('id')->pluck('reason', 'action')->all(),
        );
        $this->assertSame([$this->admin->id], PlatformAuditLog::query()->distinct()->pluck('platform_admin_id')->all());
        $change = PlatformAuditLog::query()->where('action', 'tenant.plan_changed')->firstOrFail();
        $this->assertSame([['formule' => 'Commerce'], ['formule' => 'Réseau']], [$change->old_values, $change->new_values]);
    }

    public function test_lists_filter_by_state_and_show_every_space(): void
    {
        $a = $this->createTenant('kone');
        $b = $this->createTenant('bamba', email: 'b@example.ci', phone: '0700000002');
        $b['tenant']->subscription->update(['ends_at' => null, 'trial_ends_at' => now()->addDays(3)]);
        $this->actingAs($this->admin, 'platform');

        Livewire::test(ListTenants::class)->assertCanSeeTableRecords([$a['tenant'], $b['tenant']])
            ->filterTable('state', 'trial')->assertCanSeeTableRecords([$b['tenant']])->assertCanNotSeeTableRecords([$a['tenant']])
            ->filterTable('state', 'active')->assertCanSeeTableRecords([$a['tenant']])->assertCanNotSeeTableRecords([$b['tenant']]);
        Livewire::test(ListUsers::class)->assertCanSeeTableRecords([$a['owner'], $b['owner']]);
    }

    public function test_user_actions_and_support_mode(): void
    {
        ['tenant' => $tenant, 'owner' => $owner, 'shop' => $shop] = $this->createTenant();
        $seller = $this->createUser($tenant, ['sales.create'], [$shop], ['firstname' => 'Fatou', 'email' => 'fatou@example.ci', 'password' => 'secret123']);
        $this->actingAs($this->admin, 'platform');

        Livewire::test(ListUsers::class)->callAction(TestAction::make('deactivate')->table($seller), data: ['reason' => 'Départ de l’employée'])->assertHasNoActionErrors();
        $this->assertFalse($tenant->run(fn () => $seller->fresh()->is_active));
        $this->api('kone', 'POST', '/auth/login', ['login' => 'fatou@example.ci', 'password' => 'secret123'])->assertUnprocessable();

        Livewire::test(ListUsers::class)->callAction(TestAction::make('support')->table($owner), data: ['minutes' => 15, 'reason' => 'Ticket 42 : stock faux'])->assertHasNoActionErrors()->assertNotified('Session d’assistance prête');
        $log = PlatformAuditLog::query()->where('action', 'support.session_started')->firstOrFail();
        $this->assertSame('Ticket 42 : stock faux', $log->reason);
        // Visible aussi dans le journal de l'espace.
        $this->assertTrue($tenant->run(fn () => DB::table('audit_logs')->where('action', 'support.session_started')->where('reason', 'like', '%Ticket 42%')->exists()));

        // Côté espace : la garde des utilisateurs (le panneau, lui, est sur le domaine central).
        $this->app['auth']->shouldUse('web');
        $this->app['auth']->forgetGuards();
        // Le lien ouvre l'espace en tant que propriétaire, avec le bandeau, sans changer sa dernière connexion.
        $url = app(PlatformAdministration::class)->startSupportSession($owner, $this->admin, 'Suite du ticket 42', 15);
        $token = substr($url, strpos($url, '=') + 1);
        $this->api('kone', 'POST', '/auth/token-login', ['token' => $token])->assertOk()
            ->assertJsonPath('data.support.admin_name', 'Équipe GStock')->assertJsonPath('data.user.id', $owner->id);
        $this->assertNull($tenant->run(fn () => $owner->fresh()->last_login_at));
        $this->api('kone', 'GET', '/me')->assertOk();
        // Fin de la durée prévue : la session s'arrête d'elle-même.
        $this->travel(16)->minutes();
        $this->api('kone', 'GET', '/me')->assertUnauthorized()->assertJsonPath('message', 'La session d’assistance est terminée.');
    }

    public function test_invoice_reminder_and_plan_changes_are_logged(): void
    {
        ['tenant' => $tenant] = $this->createTenant();
        Mail::fake();
        $this->actingAs($this->admin, 'platform');
        $invoice = TenantInvoice::create(['tenant_id' => $tenant->id, 'tenant_subscription_id' => $tenant->subscription->id, 'plan_id' => $tenant->subscription->plan_id,
            'reference' => 'FA-9', 'amount' => '12000', 'status' => 'failed']);

        Livewire::test(ListTenantInvoices::class)->callAction(TestAction::make('remind')->table($invoice))->assertHasNoActionErrors();
        Mail::assertSent(InvoiceReminder::class, fn ($m) => $m->hasTo('owner@example.ci'));

        $plan = Plan::query()->where('name', 'Essentiel')->firstOrFail();
        Livewire::test(EditPlan::class, ['record' => $plan->getRouteKey()])->fillForm(['price' => 6000])->call('save')->assertHasNoFormErrors();
        $this->assertSame(['price' => '5000.00'], PlatformAuditLog::query()->where('action', 'plan.updated')->value('old_values'));
        $this->assertSame(['invoice.reminder_sent', 'plan.updated'], PlatformAuditLog::query()->orderBy('id')->pluck('action')->all());
    }

    public function test_dashboard_metrics_match_the_data(): void
    {
        $a = $this->createTenant('kone');
        $b = $this->createTenant('bamba', email: 'b@example.ci', phone: '0700000002');
        $this->api('kone', 'POST', '/products', ['name' => 'Riz', 'price' => '1000', 'initial_quantity' => '5', 'shop_id' => $a['shop']->id], as: $a['owner'])->assertCreated();
        TenantInvoice::create(['tenant_id' => $a['tenant']->id, 'tenant_subscription_id' => $a['tenant']->subscription->id, 'plan_id' => $a['tenant']->subscription->plan_id,
            'reference' => 'FA-1', 'amount' => '12000', 'status' => 'paid', 'paid_at' => now()]);

        $m = PlatformMetrics::overview();
        $this->assertSame(2, $m['tenants']);
        $this->assertSame(1, $m['activated']);
        $this->assertSame(0, $m['first_sale']);
        $this->assertSame(1, $m['paying']);
        $this->assertSame('12000.00', number_format((float) $m['revenue_month'], 2, '.', ''));
    }
}
