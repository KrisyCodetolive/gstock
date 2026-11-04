// Échéanciers (§7.7), communs aux crédits clients et aux dettes fournisseurs.
// Les paiements soldent les échéances de la plus ancienne à la plus récente ;
// une échéance dépassée et non soldée est « en retard ».
import { Validator } from './http'

export interface MockInstallment {
  id: number
  due_date: string
  amount: number
  /** Échéance déjà payée, gardée telle quelle quand l'échéancier est refait. */
  frozen: boolean
}

export type InstallmentState = 'paid' | 'overdue' | 'partial' | 'pending'

const round2 = (n: number) => Math.round(n * 100) / 100
const num = (v: unknown) => (v === undefined || v === null || v === '' ? NaN : Number(String(v).replace(',', '.')))
const today = () => new Date().toISOString().slice(0, 10)

/** État de chaque échéance pour un reste dû donné. */
export function scheduleOf(installments: MockInstallment[] | undefined, remaining: number) {
  const items = [...(installments ?? [])].sort((a, b) => a.due_date.localeCompare(b.due_date) || a.id - b.id)
  const active = items.filter((i) => !i.frozen)
  let paidPool = round2(Math.max(active.reduce((s, i) => s + i.amount, 0) - remaining, 0))
  return items.map((i) => {
    let paid = i.amount
    if (!i.frozen) {
      paid = round2(Math.min(paidPool, i.amount))
      paidPool = round2(paidPool - paid)
    }
    const status: InstallmentState = paid >= i.amount ? 'paid' : i.due_date < today() ? 'overdue' : paid > 0 ? 'partial' : 'pending'
    return { id: i.id, due_date: i.due_date, amount: i.amount, paid_amount: paid, status }
  })
}

/**
 * Nouvel échéancier : les échéances déjà soldées restent ; les nouvelles
 * couvrent exactement le reste dû. Lève un 422 en français sinon.
 */
export function buildSchedule(
  current: MockInstallment[] | undefined,
  remaining: number,
  input: { due_date?: string; amount?: string }[],
  lastId: number,
): MockInstallment[] {
  const v = new Validator()
  const parsed = input.map((i) => ({ due_date: String(i.due_date ?? ''), amount: round2(num(i.amount)) }))
  v.check(parsed.length > 0, 'installments', 'Ajoutez au moins une échéance.')
  v.check(parsed.every((i) => /^\d{4}-\d{2}-\d{2}$/.test(i.due_date)), 'installments', 'Chaque échéance a besoin d’une date.')
  v.check(parsed.every((i) => i.amount > 0), 'installments', 'Chaque échéance a besoin d’un montant supérieur à 0.')
  const total = round2(parsed.reduce((s, i) => s + i.amount, 0))
  v.check(total === remaining, 'installments', `Le total des échéances doit être égal au reste : ${remaining.toLocaleString('fr-FR')} FCFA (actuellement ${total.toLocaleString('fr-FR')} FCFA).`)
  v.done()
  let id = lastId
  const frozen = scheduleOf(current, remaining)
    .filter((i) => i.paid_amount > 0)
    .map((i) => ({ id: i.id, due_date: i.due_date, amount: i.paid_amount, frozen: true }))
  return [...frozen, ...parsed.map((i) => ({ id: ++id, due_date: i.due_date, amount: i.amount, frozen: false }))]
}
