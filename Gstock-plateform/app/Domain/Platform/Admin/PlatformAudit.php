<?php

namespace App\Domain\Platform\Admin;

use App\Domain\Platform\Models\PlatformAdmin;
use App\Domain\Platform\Models\PlatformAuditLog;
use App\Domain\Platform\Models\Tenant;

/** Journalise une action d'un super-admin (M01) : auteur, espace, objet, motif, avant / après. */
final class PlatformAudit
{
    public static function record(PlatformAdmin $admin, string $action, ?Tenant $tenant = null, array $options = []): PlatformAuditLog
    {
        return PlatformAuditLog::create([
            'platform_admin_id' => $admin->id,
            'action' => $action,
            'tenant_id' => $tenant?->id,
            'subject_type' => $options['subject_type'] ?? null,
            'subject_id' => $options['subject_id'] ?? null,
            'subject_label' => $options['label'] ?? $tenant?->name,
            'reason' => $options['reason'] ?? null,
            'old_values' => $options['old'] ?? null,
            'new_values' => $options['new'] ?? null,
            'ip' => request()?->ip(),
        ]);
    }

    /** Libellés des actions, pour le journal. */
    public const LABELS = [
        'tenant.suspended' => 'Espace suspendu',
        'tenant.reactivated' => 'Espace réactivé',
        'tenant.trial_extended' => 'Essai prolongé',
        'tenant.plan_changed' => 'Formule changée',
        'user.deactivated' => 'Utilisateur désactivé',
        'user.reactivated' => 'Utilisateur réactivé',
        'user.password_reset_sent' => 'Lien de mot de passe envoyé',
        'support.session_started' => 'Connexion en mode support',
        'plan.created' => 'Formule créée',
        'plan.updated' => 'Formule modifiée',
        'invoice.reminder_sent' => 'Relance de facture',
    ];
}
