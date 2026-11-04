<?php

namespace App\Domain\Audit;

use App\Domain\Audit\Models\AuditLog;
use App\Domain\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * Journalise une action sensible (M14) : auteur, boutique, objet, motif,
 * avant / après. Aucun secret n'y est jamais écrit (clés, mots de passe).
 */
final class Audit
{
    /**
     * @param  array{shop_id?: ?int, subject?: ?Model, label?: ?string, reason?: ?string, old?: ?array, new?: ?array}  $options
     */
    public static function record(?User $user, string $action, array $options = []): AuditLog
    {
        $subject = $options['subject'] ?? null;

        return AuditLog::create([
            'shop_id' => $options['shop_id'] ?? null,
            'user_id' => $user?->id,
            'action' => $action,
            'subject_type' => $subject ? str($subject->getTable())->singular()->toString() : null,
            'subject_id' => $subject?->getKey(),
            'subject_label' => $options['label'] ?? null,
            'old_values' => $options['old'] ?? null,
            'new_values' => $options['new'] ?? null,
            'reason' => $options['reason'] ?? null,
            'ip' => request()?->ip(),
        ]);
    }
}
