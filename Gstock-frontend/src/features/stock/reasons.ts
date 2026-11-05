import type { AdjustmentKind, ExitReason } from '@/types/stock'

/** Motifs proposés pour un mouvement manuel ; « other » demande une précision écrite. */
export const ADJUSTMENT_REASONS: Record<AdjustmentKind, string[]> = {
  entry: ['entry_received', 'entry_return', 'entry_found', 'other'],
  // Liste du cahier (§7.11) : périmé, cassé et volé comptent dans les pertes (§7.8).
  exit: ['exit_expired', 'exit_broken', 'exit_stolen', 'exit_used', 'other'],
  inventory: ['inventory_count', 'other'],
}

/** Motif de sortie envoyé au serveur pour chaque choix de la liste. */
export const EXIT_REASON: Record<string, ExitReason> = {
  exit_expired: 'expired',
  exit_broken: 'damaged',
  exit_stolen: 'stolen',
  exit_used: 'consumed',
  other: 'other',
}

/** Date saisie dans un champ date (Y-m-d), ou null si vide. */
export const expiryOrNull = (value: string) => (value.trim() === '' ? null : value)
