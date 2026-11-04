// Règles de crédit du serveur (§7.6, §7.7, décision P3), partagées par les handlers.
// Le reste d'un crédit n'est jamais saisi : il est recalculé à chaque opération.
import type { MockCredit, MockRepayment } from './data/customers'
import type { MockUser } from './data/users'
import { db, nextReference } from './db'
import { MockHttpError, permissionsOf, Validator } from './http'
import { buildSchedule, scheduleOf } from './installments'

const round2 = (n: number) => Math.round(n * 100) / 100
const now = () => new Date().toISOString()

/** Affectations confirmées d'un crédit (les remboursements en attente ou annulés ne comptent pas). */
export function allocationsOf(creditId: number) {
  return db.repayments.flatMap((r) =>
    r.status === 'completed' ? r.allocations.filter((a) => a.credit_id === creditId).map((a) => ({ repayment: r, amount: a.amount })) : [],
  )
}

export function repaidOf(credit: MockCredit) {
  return round2(allocationsOf(credit.id).reduce((s, a) => s + a.amount, 0))
}

export function adjustedOf(credit: MockCredit) {
  return round2(db.creditAdjustments.filter((a) => a.credit_id === credit.id).reduce((s, a) => s + a.amount, 0))
}

/** Reste = montant − Σ affectations − Σ régularisations ; état déduit (§7.6). */
export function recomputeCredit(credit: MockCredit) {
  if (credit.status === 'cancelled') {
    credit.remaining_amount = 0
    return
  }
  const paid = repaidOf(credit) + adjustedOf(credit)
  credit.remaining_amount = round2(Math.max(credit.amount - paid, 0))
  credit.status = credit.remaining_amount === 0 ? 'settled' : paid > 0 ? 'partial' : 'open'
}

export function recomputeCustomer(customerId: number) {
  for (const c of db.credits) if (c.customer_id === customerId) recomputeCredit(c)
}

/** Crédits ouverts d'un client dans une boutique, du plus ancien au plus récent. */
export function openCredits(customerId: number, shopId: number) {
  return db.credits
    .filter((c) => c.customer_id === customerId && c.shop_id === shopId && c.status !== 'cancelled' && c.remaining_amount > 0)
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at) || a.id - b.id)
}

/** Affectation par défaut : du plus ancien au plus récent (§7.6). */
export function autoAllocate(amount: number, credits: MockCredit[]) {
  let left = amount
  const out: { credit_id: number; amount: number }[] = []
  for (const c of credits) {
    if (left <= 0) break
    const part = round2(Math.min(left, c.remaining_amount))
    if (part > 0) out.push({ credit_id: c.id, amount: part })
    left = round2(left - part)
  }
  return out
}

/** Avoir d'un client dans une boutique : somme que la boutique lui doit (P3). */
export function creditNoteBalance(customerId: number, shopId?: number) {
  return round2(
    db.creditNotes.filter((e) => e.customer_id === customerId && (shopId === undefined || e.shop_id === shopId)).reduce((s, e) => s + e.amount, 0),
  )
}

function addCreditNote(entry: Omit<(typeof db.creditNotes)[number], 'id' | 'created_at'>) {
  db.creditNotes.push({ id: db.creditNotes.length + 1, created_at: now(), ...entry })
}

const num = (v: unknown) => (v === undefined || v === null || v === '' ? NaN : Number(String(v).replace(',', '.')))

export interface RepaymentInput {
  customer_id?: number
  amount?: string
  payment_method_id?: number | null
  use_credit_note?: boolean
  received_at?: string
  note?: string | null
  allocations?: { credit_id: number; amount: string }[]
  offline_uuid?: string
}

/**
 * Enregistre un remboursement RB-N : affectations proposées du plus ancien au plus
 * récent ou choisies, jamais au-delà du montant reçu (§7.6). Paiement GeniusPay :
 * en attente jusqu'au webhook, il ne compte qu'une fois confirmé (ADR-003).
 */
export function recordRepayment(shopId: number, user: MockUser, input: RepaymentInput): MockRepayment {
  const v = new Validator()
  const customer = db.customers.find((c) => c.id === Number(input.customer_id))
  if (!customer) throw new MockHttpError(422, 'Choisissez un client.', { customer_id: ['Choisissez un client.'] })
  recomputeCustomer(customer.id)
  const credits = openCredits(customer.id, shopId)
  const due = round2(credits.reduce((s, c) => s + c.remaining_amount, 0))

  const amount = round2(num(input.amount))
  v.check(amount > 0, 'amount', 'Saisissez le montant reçu.')
  v.check(!(amount > due), 'amount', due > 0 ? `Le client ne doit que ${due.toLocaleString('fr-FR')} FCFA dans cette boutique.` : 'Ce client ne doit rien dans cette boutique.')

  const useNote = input.use_credit_note === true
  const method = useNote ? null : db.paymentMethods.find((m) => m.id === Number(input.payment_method_id) && m.is_active)
  if (!useNote) v.check(Boolean(method), 'payment_method_id', 'Choisissez le mode de paiement.')
  if (useNote) {
    const note = creditNoteBalance(customer.id, shopId)
    v.check(amount <= note, 'amount', `L'avoir du client n'est que de ${note.toLocaleString('fr-FR')} FCFA.`)
  }

  let allocations = autoAllocate(amount, credits)
  if (input.allocations?.length) {
    allocations = input.allocations.map((a) => ({ credit_id: Number(a.credit_id), amount: round2(num(a.amount)) })).filter((a) => a.amount > 0)
    for (const a of allocations) {
      const credit = credits.find((c) => c.id === a.credit_id)
      if (!credit) v.add('allocations', 'Un des crédits choisis n’est plus ouvert.')
      else if (a.amount > credit.remaining_amount) v.add('allocations', `Le crédit ${credit.reference} n'a plus que ${credit.remaining_amount.toLocaleString('fr-FR')} FCFA à payer.`)
    }
    const total = round2(allocations.reduce((s, a) => s + a.amount, 0))
    // La somme affectée ne dépasse jamais le montant reçu, et tout le montant est affecté.
    v.check(total === amount, 'allocations', `Répartissez exactement ${amount.toLocaleString('fr-FR')} FCFA (actuellement ${total.toLocaleString('fr-FR')} FCFA).`)
  }
  v.done()

  const pending = !useNote && method!.uses_geniuspay && db.paymentSettings.is_active
  const repayment: MockRepayment = {
    id: db.repayments.length + 1,
    shop_id: shopId,
    customer_id: customer.id,
    reference: nextReference('RB'),
    offline_uuid: input.offline_uuid ?? null,
    received_at: input.received_at && !Number.isNaN(Date.parse(input.received_at)) ? new Date(input.received_at).toISOString() : now(),
    amount,
    payment_method_id: method?.id ?? null,
    allocations,
    note: input.note?.trim() || null,
    status: pending ? 'pending' : 'completed',
    user_id: user.id,
    cancelled_at: null,
    cancel_reason: null,
  }
  db.repayments.push(repayment)
  if (useNote) addCreditNote({ shop_id: shopId, customer_id: customer.id, amount: -amount, source: 'repayment', source_id: repayment.id })
  recomputeCustomer(customer.id)
  return repayment
}

/** Annuler un remboursement libère ses affectations et recalcule les restes (§7.6). */
export function cancelRepayment(repayment: MockRepayment, reason: string) {
  if (repayment.status === 'cancelled') throw new MockHttpError(409, 'Ce paiement a déjà été annulé.')
  const settled = repayment.allocations.some((a) => db.credits.find((c) => c.id === a.credit_id)?.cancel_settlement)
  if (settled) {
    throw new MockHttpError(409, 'Une partie de ce paiement a déjà été rendue au client ou gardée en avoir lors d’une annulation : il ne peut plus être annulé.')
  }
  Object.assign(repayment, { status: 'cancelled', cancelled_at: now(), cancel_reason: reason })
  if (repayment.payment_method_id === null) {
    addCreditNote({ shop_id: repayment.shop_id, customer_id: repayment.customer_id, amount: repayment.amount, source: 'repayment_cancel', source_id: repayment.id })
  }
  recomputeCustomer(repayment.customer_id)
}

export interface Settlement {
  refund_mode?: 'credit_note' | 'refund'
  refund_payment_method_id?: number
}

/**
 * Décision P3 : à l'annulation d'un crédit déjà en partie payé, l'argent reçu
 * n'est jamais perdu. Le commerçant choisit : avoir au nom du client, ou argent rendu.
 * Appelé avant l'annulation ; lève une 422 si le choix manque.
 */
export function checkSettlement(credit: MockCredit, settlement: Settlement) {
  const repaid = repaidOf(credit)
  if (repaid <= 0) return 0
  const v = new Validator()
  const message = `Ce client a déjà payé ${repaid.toLocaleString('fr-FR')} FCFA sur ce crédit : choisissez de les garder en avoir ou de les lui rendre.`
  v.check(settlement.refund_mode === 'credit_note' || settlement.refund_mode === 'refund', 'refund_mode', message)
  if (settlement.refund_mode === 'refund') {
    const ok = db.paymentMethods.some((m) => m.id === Number(settlement.refund_payment_method_id) && m.is_active)
    v.check(ok, 'refund_payment_method_id', "Choisissez comment l'argent est rendu.")
  }
  v.done()
  return repaid
}

export function applySettlement(credit: MockCredit, user: MockUser, settlement: Settlement, reason: string, repaid: number) {
  if (repaid > 0 && settlement.refund_mode === 'credit_note') {
    addCreditNote({ shop_id: credit.shop_id, customer_id: credit.customer_id, amount: repaid, source: 'credit_cancel', source_id: credit.id })
  }
  if (repaid > 0 && settlement.refund_mode === 'refund') {
    db.customerRefunds.push({
      id: db.customerRefunds.length + 1,
      shop_id: credit.shop_id,
      customer_id: credit.customer_id,
      credit_id: credit.id,
      amount: repaid,
      payment_method_id: Number(settlement.refund_payment_method_id),
      reason,
      user_id: user.id,
      created_at: now(),
    })
  }
  Object.assign(credit, {
    status: 'cancelled',
    remaining_amount: 0,
    cancelled_at: now(),
    cancel_reason: reason,
    cancel_settlement: repaid > 0 ? { mode: settlement.refund_mode!, amount: repaid } : null,
  })
}

/** Annuler un crédit sans vente (solde initial). Un crédit de vente s'annule avec sa vente. */
export function cancelCredit(credit: MockCredit, user: MockUser, reason: string, settlement: Settlement) {
  if (credit.status === 'cancelled') throw new MockHttpError(409, 'Ce crédit a déjà été annulé.')
  if (credit.sale_id) throw new MockHttpError(409, 'Ce crédit vient d’une vente : annulez la vente pour l’annuler.')
  const repaid = checkSettlement(credit, settlement)
  applySettlement(credit, user, settlement, reason, repaid)
}

/** Régularisation : positif = diminue le reste (geste commercial), négatif = l'augmente (erreur). */
export function adjustCredit(credit: MockCredit, user: MockUser, amountInput: unknown, reason: unknown) {
  if (credit.status === 'cancelled') throw new MockHttpError(409, 'Ce crédit est annulé.')
  recomputeCredit(credit)
  const v = new Validator()
  const amount = round2(num(amountInput))
  v.check(amount !== 0 && !Number.isNaN(amount), 'amount', 'Saisissez un montant différent de 0.')
  v.required(reason, 'reason', 'Indiquez le motif de la régularisation.')
  const after = round2(credit.remaining_amount - amount)
  v.check(after >= 0, 'amount', `Le reste ne peut pas devenir négatif : il est de ${credit.remaining_amount.toLocaleString('fr-FR')} FCFA.`)
  v.check(after <= credit.amount - repaidOf(credit), 'amount', 'Le reste ne peut pas dépasser le montant du crédit.')
  v.done()
  db.creditAdjustments.push({ id: db.creditAdjustments.length + 1, credit_id: credit.id, amount, reason: String(reason).trim(), user_id: user.id, created_at: now() })
  recomputeCredit(credit)
}

/** Échéances calculées : soldées de la plus ancienne à la plus récente, en retard si dépassées (§7.7). */
export function installmentsOf(credit: MockCredit) {
  return scheduleOf(credit.installments, credit.remaining_amount)
}

/**
 * Nouvel échéancier : les échéances déjà soldées restent telles quelles ; les
 * nouvelles couvrent exactement le reste dû (§7.7).
 */
export function setInstallments(credit: MockCredit, items: { due_date?: string; amount?: string }[]) {
  if (credit.status === 'cancelled' || credit.status === 'settled') throw new MockHttpError(409, 'Ce crédit n’a plus de reste à payer.')
  recomputeCredit(credit)
  const lastId = Math.max(0, ...db.credits.flatMap((c) => (c.installments ?? []).map((i) => i.id)))
  credit.installments = buildSchedule(credit.installments, credit.remaining_amount, items, lastId)
}

export function canSeeAllCredits(user: MockUser) {
  return permissionsOf(user).includes('records.view_all')
}
