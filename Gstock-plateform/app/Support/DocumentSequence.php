<?php

namespace App\Support;

use App\Domain\Platform\CurrentTenant;
use Illuminate\Support\Facades\DB;

/**
 * Références PRÉFIXE-N par espace (§7.9) : V-, CR-, RB-, AP-, MS-, DP-, et P- pour
 * les codes produits. La ligne est verrouillée : sûr en concurrence. À appeler
 * dans la transaction de l'opération, pour qu'un échec ne consomme pas de numéro.
 */
final class DocumentSequence
{
    public static function next(string $type): int
    {
        $tenantId = CurrentTenant::get()->id;
        DB::table('document_sequences')->insertOrIgnore([
            'tenant_id' => $tenantId, 'document_type' => $type, 'next_number' => 1, 'created_at' => now(), 'updated_at' => now(),
        ]);
        $row = DB::table('document_sequences')->where('tenant_id', $tenantId)->where('document_type', $type)->lockForUpdate()->first();
        DB::table('document_sequences')->where('id', $row->id)->update(['next_number' => $row->next_number + 1, 'updated_at' => now()]);

        return (int) $row->next_number;
    }

    public static function reference(string $prefix): string
    {
        return $prefix.'-'.self::next($prefix);
    }
}
