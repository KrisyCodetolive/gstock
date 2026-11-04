// Contrat d'API du module M10 : clients. Les clients sont communs à l'espace ;
// leurs crédits sont suivis par boutique (P5).
import type { Id, IsoDate, Money } from './api'

/** Ressource /customers */
export interface Customer {
  id: Id
  name: string
  phone: string | null
  district: string | null
  note: string | null
  is_active: boolean
  created_at: IsoDate
  /** Reste à payer sur tous ses crédits ouverts, toutes boutiques (§7.6). */
  balance: Money
  /** Avoir : somme que la boutique doit au client (décision P3). */
  credit_note_balance: Money
}

export interface CustomerPayload {
  name: string
  phone: string | null
  district: string | null
  note: string | null
  is_active: boolean
}

export type CreditStatus = 'open' | 'partial' | 'settled' | 'cancelled'

/** Crédit client, créé automatiquement par une vente avec un reste (§7.5). */
export interface CustomerCredit {
  id: Id
  reference: string
  shop: { id: Id; name: string }
  sale: { id: Id; reference: string } | null
  is_opening_balance: boolean
  amount: Money
  remaining_amount: Money
  status: CreditStatus
  occurred_at: IsoDate
}

/** GET /customers/{id}/summary : la fiche client. */
export interface CustomerSummary {
  customer: Customer
  /** Solde par boutique accessible. */
  balances: { shop: { id: Id; name: string }; balance: Money }[]
  purchases: {
    count: number
    total: Money
    last_at: IsoDate | null
  }
  recent_sales: {
    id: Id
    reference: string
    shop: { id: Id; name: string }
    total: Money
    payment_status: 'paid' | 'partial' | 'credit'
    status: 'completed' | 'cancelled'
    occurred_at: IsoDate
  }[]
  credits: CustomerCredit[]
}
