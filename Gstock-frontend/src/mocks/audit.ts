// Journal d'activité du serveur (M14, ADR-012) : actions sensibles, avec l'auteur,
// la boutique, l'objet, le motif, et l'état avant / après. Aucun secret n'y est écrit.
import type { MockUser } from './data/users'
import { db } from './db'

export interface MockAuditLog {
  id: number
  action: string
  shop_id: number | null
  user_id: number
  subject: { type: string; id: number; label: string } | null
  reason: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  created_at: string
}

export function audit(
  user: MockUser,
  action: string,
  options: {
    shopId?: number | null
    subject?: { type: string; id: number; label: string } | null
    reason?: string | null
    old?: Record<string, unknown> | null
    new?: Record<string, unknown> | null
    at?: string
  } = {},
) {
  db.auditLogs.push({
    id: db.auditLogs.length + 1,
    action,
    shop_id: options.shopId ?? null,
    user_id: user.id,
    subject: options.subject ?? null,
    reason: options.reason ?? null,
    old_values: options.old ?? null,
    new_values: options.new ?? null,
    created_at: options.at ?? new Date().toISOString(),
  })
}
