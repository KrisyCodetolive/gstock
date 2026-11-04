// Fournisseurs de démonstration (§11.3) et forme des approvisionnements et dépenses simulés.
export interface MockSupplier {
  id: number
  name: string
  phone: string | null
  address: string | null
  note: string | null
  is_active: boolean
}

export interface MockPurchase {
  id: number
  shop_id: number
  supplier_id: number | null
  reference: string
  occurred_at: string
  items: { product_id: number; quantity: number; cost: number; subtotal: number }[]
  subtotal: number
  discount: number
  total: number
  status: 'received' | 'cancelled'
  payments: { id: number; amount: number; payment_method_id: number; paid_at: string; note: string | null; user_id: number; status: 'completed' | 'cancelled' }[]
  note: string | null
  user_id: number
  cancelled_at: string | null
  cancel_reason: string | null
}

export interface MockExpense {
  id: number
  shop_id: number
  reference: string
  offline_uuid: string | null
  occurred_at: string
  expense_category_id: number
  amount: number
  payment_method_id: number
  note: string | null
  user_id: number
  status: 'completed' | 'cancelled'
  cancelled_at: string | null
  cancel_reason: string | null
}

export const suppliers: MockSupplier[] = [
  { id: 1, name: 'Grossiste Adjamé Distribution', phone: '0101020304', address: 'Marché d’Adjamé, Abidjan', note: 'Livraison le mardi.', is_active: true },
  { id: 2, name: 'SIFCA Huiles', phone: '0505060708', address: 'Zone industrielle de Yopougon', note: null, is_active: true },
  { id: 3, name: 'Brasseries du Plateau', phone: '0707080910', address: 'Plateau, Abidjan', note: null, is_active: true },
  { id: 4, name: 'Moussa Commerce', phone: '0144556677', address: 'Treichville', note: 'Paie à 30 jours.', is_active: true },
  { id: 5, name: 'Hygiène Plus', phone: null, address: 'Marcory', note: null, is_active: true },
]
