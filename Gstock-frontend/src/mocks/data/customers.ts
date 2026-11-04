// Clients de démonstration (§11.3) : 30 clients du quartier.
import type { MockInstallment } from '../installments'

export interface MockCustomer {
  id: number
  name: string
  phone: string | null
  district: string | null
  note: string | null
  is_active: boolean
  created_at: string
}

export interface MockCredit {
  id: number
  shop_id: number
  customer_id: number
  sale_id: number | null
  reference: string
  occurred_at: string
  amount: number
  remaining_amount: number
  is_opening_balance: boolean
  status: 'open' | 'partial' | 'settled' | 'cancelled'
  user_id: number
  note?: string | null
  cancelled_at?: string | null
  cancel_reason?: string | null
  /** Décision P3 : argent déjà reçu gardé en avoir ou rendu au client. */
  cancel_settlement?: { mode: 'credit_note' | 'refund'; amount: number } | null
  /** Échéancier (§7.7). `frozen` : échéance soldée gardée telle quelle après un nouvel échéancier. */
  installments?: MockInstallment[]
}

export interface MockRepayment {
  id: number
  shop_id: number
  customer_id: number
  reference: string
  offline_uuid: string | null
  received_at: string
  amount: number
  /** null : payé avec l'avoir du client. */
  payment_method_id: number | null
  allocations: { credit_id: number; amount: number }[]
  note: string | null
  status: 'pending' | 'completed' | 'cancelled'
  user_id: number
  cancelled_at: string | null
  cancel_reason: string | null
}

export interface MockCreditAdjustment {
  id: number
  credit_id: number
  amount: number
  reason: string
  user_id: number
  created_at: string
}

/** Mouvements d'avoir d'un client dans une boutique : + créé, − utilisé (P3). */
export interface MockCreditNoteEntry {
  id: number
  shop_id: number
  customer_id: number
  amount: number
  source: 'credit_cancel' | 'repayment' | 'repayment_cancel' | 'sale' | 'sale_cancel'
  source_id: number
  created_at: string
}

export interface MockCustomerRefund {
  id: number
  shop_id: number
  customer_id: number
  credit_id: number
  amount: number
  payment_method_id: number
  reason: string
  user_id: number
  created_at: string
}

const NAMES: [string, string | null, string | null][] = [
  ['Awa Koné', '0748219033', 'Angré'],
  ['Mamadou Coulibaly', '0505112233', 'Angré'],
  ['Adjoua Kouassi', '0707445566', 'Riviera 2'],
  ['Yao Kouadio', null, 'Angré'],
  ['Fatoumata Diarra', '0101778899', 'Deux-Plateaux'],
  ['Serge Ahoua', '0566001122', 'Siporex'],
  ['Mariam Ouattara', '0749332211', 'Siporex'],
  ['Kofi Mensah', '0102030405', 'Yopougon Selmer'],
  ['Aïcha Touré', '0758665544', 'Angré'],
  ['Brou Kouamé', null, 'Siporex'],
  ['Salimata Sanogo', '0503998877', 'Riviera 3'],
  ['Jean-Marc Gnagne', '0700112244', 'Angré'],
  ['Rokia Traoré', '0544556677', 'Siporex'],
  ['Ibrahima Fofana', '0177889900', 'Yopougon Maroc'],
  ['Christelle Aka', '0709871234', 'Riviera 2'],
  ['Moussa Kanté', null, 'Siporex'],
  ['Nadège Yapi', '0565432198', 'Angré'],
  ['Abdoulaye Cissé', '0145671234', 'Siporex'],
  ['Clarisse N’Dri', '0778123456', 'Deux-Plateaux'],
  ['Lassina Bamba', '0599887766', 'Yopougon Selmer'],
  ['Prisca Kacou', '0712349876', 'Angré'],
  ['Oumar Sylla', null, 'Siporex'],
  ['Estelle Boni', '0123459876', 'Riviera 3'],
  ['Hamed Konaté', '0577665544', 'Siporex'],
  ['Viviane Koffi', '0745671239', 'Angré'],
  ['Souleymane Dembélé', '0136547890', 'Yopougon Maroc'],
  ['Béatrice Assi', '0703214569', 'Angré'],
  ['Drissa Keïta', '0598741236', 'Siporex'],
  ['Pauline Gbané', null, 'Riviera 2'],
  ['Zié Soro', '0147852369', 'Siporex'],
]

export const customers: MockCustomer[] = NAMES.map(([name, phone, district], i) => ({
  id: i + 1,
  name,
  phone,
  district,
  note: i === 0 ? 'Cliente fidèle, paie en fin de mois.' : null,
  is_active: true,
  created_at: new Date(Date.UTC(2026, 8, 1 + i)).toISOString(),
}))

/** Anciennes dettes saisies à la mise en place (« solde initial », §7.6). */
export const openingBalances: { customer_id: number; shop_id: number; amount: number }[] = [
  { customer_id: 4, shop_id: 1, amount: 7500 },
  { customer_id: 10, shop_id: 2, amount: 12000 },
  { customer_id: 16, shop_id: 2, amount: 4500 },
]
