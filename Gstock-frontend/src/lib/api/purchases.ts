// Endpoints des modules M11 (fournisseurs, approvisionnements) et M12 (dépenses).
import type { Id, ListParams, Paginated, Resource } from '@/types/api'
import type {
  Expense,
  ExpensePayload,
  ExpensesList,
  Purchase,
  PurchasePayload,
  PurchaseQuote,
  PurchaseQuoteInput,
  PurchasesList,
  Supplier,
  SupplierPayload,
} from '@/types/purchases'
import type { InstallmentScheduleItem } from '@/types/credits'
import { http } from './client'

export function listSuppliers(params: ListParams = {}): Promise<Paginated<Supplier>> {
  return http.get<Paginated<Supplier>>('/suppliers', params)
}

export async function getSupplier(id: Id): Promise<Supplier> {
  return (await http.get<Resource<Supplier>>(`/suppliers/${id}`)).data
}

export async function createSupplier(payload: SupplierPayload): Promise<Supplier> {
  return (await http.post<Resource<Supplier>>('/suppliers', payload)).data
}

export async function updateSupplier(id: Id, payload: SupplierPayload): Promise<Supplier> {
  return (await http.put<Resource<Supplier>>(`/suppliers/${id}`, payload)).data
}

/** Total calculé par le serveur, sans rien enregistrer (§7.4). */
export async function quotePurchase(shopId: Id, input: PurchaseQuoteInput): Promise<PurchaseQuote> {
  return (await http.post<Resource<PurchaseQuote>>(`/shops/${shopId}/purchases/quote`, input)).data
}

export async function createPurchase(shopId: Id, payload: PurchasePayload): Promise<Purchase> {
  return (await http.post<Resource<Purchase>>(`/shops/${shopId}/purchases`, payload)).data
}

export function listPurchases(shopId: Id, params: ListParams = {}): Promise<PurchasesList> {
  return http.get<PurchasesList>(`/shops/${shopId}/purchases`, params)
}

export async function getPurchase(shopId: Id, id: Id): Promise<Purchase> {
  return (await http.get<Resource<Purchase>>(`/shops/${shopId}/purchases/${id}`)).data
}

export async function addPurchasePayment(
  shopId: Id,
  id: Id,
  payload: { amount: string; payment_method_id: Id; paid_at?: string; note?: string | null },
): Promise<Purchase> {
  return (await http.post<Resource<Purchase>>(`/shops/${shopId}/purchases/${id}/payments`, payload)).data
}

/** Fournisseur choisi après coup, seulement si l'approvisionnement n'en a pas (M11, ADR-012). */
export async function assignPurchaseSupplier(shopId: Id, id: Id, supplierId: Id): Promise<Purchase> {
  return (await http.put<Resource<Purchase>>(`/shops/${shopId}/purchases/${id}/supplier`, { supplier_id: supplierId })).data
}

/** Échéancier du reste dû au fournisseur (§7.7) : remplace les échéances non payées. */
export async function setPurchaseInstallments(shopId: Id, id: Id, installments: InstallmentScheduleItem[]): Promise<Purchase> {
  return (await http.put<Resource<Purchase>>(`/shops/${shopId}/purchases/${id}/installments`, { installments })).data
}

/** Annulation avec motif : la marchandise sort du stock (ADR-012). */
export async function cancelPurchase(shopId: Id, id: Id, reason: string): Promise<Purchase> {
  return (await http.post<Resource<Purchase>>(`/shops/${shopId}/purchases/${id}/cancel`, { reason })).data
}

export function listExpenses(shopId: Id, params: ListParams = {}): Promise<ExpensesList> {
  return http.get<ExpensesList>(`/shops/${shopId}/expenses`, params)
}

export async function createExpense(shopId: Id, payload: ExpensePayload): Promise<Expense> {
  return (await http.post<Resource<Expense>>(`/shops/${shopId}/expenses`, payload)).data
}

export async function cancelExpense(shopId: Id, id: Id, reason: string): Promise<Expense> {
  return (await http.post<Resource<Expense>>(`/shops/${shopId}/expenses/${id}/cancel`, { reason })).data
}
