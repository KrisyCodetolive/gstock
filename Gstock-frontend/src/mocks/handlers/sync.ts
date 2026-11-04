// Synchronisation des opérations faites hors ligne (ADR-005, M08, P2) : POST /shops/{id}/sync.
// Idempotente par offline_uuid ; un écart est enregistré et marqué « à vérifier », jamais perdu.
import { delay, http, HttpResponse } from 'msw'
import type { RepaymentPayload } from '@/types/credits'
import type { ExpensePayload } from '@/types/purchases'
import type { SalePayload } from '@/types/sales'
import type { SyncPayload, SyncResult } from '@/types/sync'
import { recordRepayment } from '../credits'
import { db, persist } from '../db'
import { API, handle, MockHttpError, permissionsOf, requireUser } from '../http'
import { recordExpense } from '../purchases'
import { recordSale } from '../sales'
import { requireShopAccess } from '../stock'

const PERMISSION = { sale: 'sales.create', repayment: 'repayments.create', expense: 'expenses.create' } as const

/** Message d'une erreur du serveur, pour l'afficher sur l'appareil. */
function messageOf(error: unknown) {
  if (error instanceof MockHttpError) return Object.values(error.errors)[0]?.[0] ?? error.message
  throw error
}

export const syncHandlers = [
  http.post(`${API}/shops/:shopId/sync`, ({ request, params }) =>
    handle(async () => {
      await delay(600)
      const user = requireUser()
      const shopId = requireShopAccess(user, params.shopId).id
      const { operations = [] } = (await request.json()) as Partial<SyncPayload>
      const granted = permissionsOf(user)

      const results: SyncResult[] = operations.map((op) => {
        const base = { offline_uuid: op.offline_uuid, type: op.type, reasons: [] as string[] }
        // Déjà reçue : on renvoie l'opération enregistrée, sans rien refaire.
        const existing =
          op.type === 'sale'
            ? db.sales.find((s) => s.offline_uuid === op.offline_uuid)
            : op.type === 'repayment'
              ? db.repayments.find((r) => r.offline_uuid === op.offline_uuid)
              : db.expenses.find((e) => e.offline_uuid === op.offline_uuid)
        if (existing) return { ...base, status: 'duplicate', resource: { id: existing.id, reference: existing.reference }, message: null }

        if (!granted.includes(PERMISSION[op.type])) {
          return { ...base, status: 'rejected', resource: null, message: "Vous n'avez plus le droit d'enregistrer cette opération." }
        }
        try {
          if (op.type === 'sale') {
            const sale = recordSale(shopId, user, { ...(op.payload as SalePayload), offline_uuid: op.offline_uuid }, op.occurred_at, { offline: true })
            const reasons = sale.review_reasons ?? []
            return { ...base, reasons, status: reasons.length ? 'to_review' : 'created', resource: { id: sale.id, reference: sale.reference }, message: null }
          }
          if (op.type === 'repayment') {
            const payload = op.payload as RepaymentPayload
            const method = db.paymentMethods.find((m) => m.id === Number(payload.payment_method_id))
            // Pas de paiement GeniusPay hors ligne (ADR-005).
            if (!method || method.type !== 'cash') {
              return { ...base, status: 'rejected', resource: null, message: 'Hors ligne, seuls les paiements en espèces sont acceptés.' }
            }
            const r = recordRepayment(shopId, user, { ...payload, received_at: op.occurred_at, offline_uuid: op.offline_uuid })
            return { ...base, status: 'created', resource: { id: r.id, reference: r.reference }, message: null }
          }
          const e = recordExpense(shopId, user, { ...(op.payload as ExpensePayload), occurred_at: op.occurred_at, offline_uuid: op.offline_uuid })
          return { ...base, status: 'created', resource: { id: e.id, reference: e.reference }, message: null }
        } catch (error) {
          return { ...base, status: 'rejected', resource: null, message: messageOf(error) }
        }
      })
      persist()
      return HttpResponse.json({ data: results })
    }),
  ),
]
