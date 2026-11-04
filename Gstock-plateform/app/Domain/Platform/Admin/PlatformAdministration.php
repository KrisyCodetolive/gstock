<?php

namespace App\Domain\Platform\Admin;

use App\Domain\Audit\Audit;
use App\Domain\Identity\Models\User;
use App\Domain\Identity\PasswordResets;
use App\Domain\Platform\Models\Plan;
use App\Domain\Platform\Models\PlatformAdmin;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Platform\Models\TenantInvoice;
use App\Domain\Platform\Registration\LoginLinks;
use Illuminate\Support\Facades\Mail;
use InvalidArgumentException;

/**
 * Actions du back-office de Genius Groups (M01). Chacune exige un motif et est
 * journalisée dans `platform_audit_logs` avec son auteur ; les actions qui
 * touchent un espace laissent aussi une trace dans son propre journal.
 */
final class PlatformAdministration
{
    public const SUPPORT_DURATIONS = [15, 30, 60];

    public function __construct(private LoginLinks $links, private PasswordResets $resets) {}

    /** Lecture seule immédiate, quel que soit l'abonnement. */
    public function suspend(Tenant $tenant, PlatformAdmin $admin, string $reason): void
    {
        $this->requireReason($reason);
        $tenant->update(['suspended_at' => now(), 'suspension_reason' => $reason]);
        PlatformAudit::record($admin, 'tenant.suspended', $tenant, ['reason' => $reason]);
    }

    public function reactivate(Tenant $tenant, PlatformAdmin $admin, string $reason): void
    {
        $this->requireReason($reason);
        $old = $tenant->suspension_reason;
        $tenant->update(['suspended_at' => null, 'suspension_reason' => null]);
        PlatformAudit::record($admin, 'tenant.reactivated', $tenant, ['reason' => $reason, 'old' => ['motif de suspension' => $old]]);
    }

    /** Ajoute des jours d'essai à partir de la fin d'essai actuelle (ou d'aujourd'hui si elle est passée). */
    public function extendTrial(Tenant $tenant, PlatformAdmin $admin, int $days, string $reason): void
    {
        $this->requireReason($reason);
        if ($days < 1 || $days > 90) {
            throw new InvalidArgumentException('Prolongez l’essai de 1 à 90 jours.');
        }
        $subscription = $tenant->subscription;
        $old = $subscription->trial_ends_at;
        $base = $old && $old->isFuture() ? $old : now();
        $subscription->update(['trial_ends_at' => $base->copy()->addDays($days)]);
        PlatformAudit::record($admin, 'tenant.trial_extended', $tenant, [
            'reason' => $reason, 'old' => ['fin d’essai' => $old?->toDateString()], 'new' => ['fin d’essai' => $subscription->trial_ends_at->toDateString(), 'jours' => $days],
        ]);
    }

    /** Changement de formule sans paiement (geste commercial, correction). */
    public function changePlan(Tenant $tenant, PlatformAdmin $admin, Plan $plan, string $reason): void
    {
        $this->requireReason($reason);
        $subscription = $tenant->subscription;
        $old = $subscription->plan->name;
        $subscription->update(['plan_id' => $plan->id]);
        PlatformAudit::record($admin, 'tenant.plan_changed', $tenant, ['reason' => $reason, 'old' => ['formule' => $old], 'new' => ['formule' => $plan->name]]);
    }

    public function setUserActive(User $user, PlatformAdmin $admin, bool $active, string $reason): void
    {
        $this->requireReason($reason);
        $tenant = Tenant::query()->findOrFail($user->tenant_id);
        $tenant->run(fn () => User::query()->whereKey($user->id)->update(['is_active' => $active]));
        PlatformAudit::record($admin, $active ? 'user.reactivated' : 'user.deactivated', $tenant, [
            'subject_type' => 'user', 'subject_id' => $user->id, 'label' => $user->name(), 'reason' => $reason,
        ]);
    }

    /** Envoie à l'utilisateur le lien de réinitialisation habituel (M02). */
    public function sendPasswordReset(User $user, PlatformAdmin $admin): void
    {
        $tenant = Tenant::query()->findOrFail($user->tenant_id);
        if (! $user->email) {
            throw new InvalidArgumentException('Ce compte n’a pas d’e-mail : le propriétaire de l’espace doit changer le mot de passe.');
        }
        $tenant->run(fn () => $this->resets->send(User::query()->findOrFail($user->id)));
        PlatformAudit::record($admin, 'user.password_reset_sent', $tenant, ['subject_type' => 'user', 'subject_id' => $user->id, 'label' => $user->name()]);
    }

    /**
     * Mode support : lien à usage unique qui ouvre l'espace en tant que cet utilisateur,
     * pour une durée limitée, avec un bandeau visible. Journalisé dans le back-office
     * et dans le journal de l'espace.
     */
    public function startSupportSession(User $user, PlatformAdmin $admin, string $reason, int $minutes): string
    {
        $this->requireReason($reason);
        if (! in_array($minutes, self::SUPPORT_DURATIONS, true)) {
            throw new InvalidArgumentException('Durée de session non prévue.');
        }
        $tenant = Tenant::query()->findOrFail($user->tenant_id);
        $until = now()->addMinutes($minutes);
        PlatformAudit::record($admin, 'support.session_started', $tenant, [
            'subject_type' => 'user', 'subject_id' => $user->id, 'label' => $user->name(), 'reason' => $reason, 'new' => ['jusqu’à' => $until->timezone(config('gstock.timezone'))->format('d/m/Y H:i')],
        ]);
        $tenant->run(fn () => Audit::record(null, 'support.session_started', [
            'label' => $user->name(), 'reason' => "Assistance GStock ({$admin->name}) : {$reason}", 'new' => ['jusqu’à' => $until->timezone(config('gstock.timezone'))->format('d/m/Y H:i')],
        ]));
        $token = $this->links->issue($tenant->id, $user->id, ['support' => ['admin' => $admin->name, 'until' => $until->toIso8601String()]]);

        return str_replace('{tenant}', $tenant->slug, config('gstock.frontend_url')).'/connexion/lien?jeton='.$token;
    }

    /** Relance manuelle d'une facture non payée, par e-mail au propriétaire. */
    public function remindInvoice(TenantInvoice $invoice, PlatformAdmin $admin): void
    {
        $tenant = $invoice->tenant;
        if ($invoice->status === 'paid') {
            throw new InvalidArgumentException('Cette facture est déjà payée.');
        }
        if (! $tenant->owner_email) {
            throw new InvalidArgumentException('Cet espace n’a pas d’e-mail de contact.');
        }
        $url = str_replace('{tenant}', $tenant->slug, config('gstock.frontend_url')).config('gstock.subscription_return_path');
        Mail::to($tenant->owner_email)->send(new InvoiceReminder($invoice, $url));
        PlatformAudit::record($admin, 'invoice.reminder_sent', $tenant, ['subject_type' => 'tenant_invoice', 'subject_id' => $invoice->id, 'label' => $invoice->reference]);
    }

    private function requireReason(string $reason): void
    {
        if (trim($reason) === '') {
            throw new InvalidArgumentException('Indiquez le motif.');
        }
    }
}
