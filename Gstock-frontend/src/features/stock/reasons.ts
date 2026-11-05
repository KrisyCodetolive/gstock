import type { AdjustmentKind } from '@/types/stock'

/** Motifs proposés pour un mouvement manuel ; « other » demande une précision écrite. */
export const ADJUSTMENT_REASONS: Record<AdjustmentKind, string[]> = {
  entry: ['entry_received', 'entry_return', 'entry_found', 'other'],
  exit: ['exit_loss', 'exit_broken', 'exit_expired', 'exit_used', 'other'],
  inventory: ['inventory_count', 'other'],
}
