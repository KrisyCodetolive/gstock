// Endpoints du module M09 : crédits clients, remboursements, échéances.
import type { Id, ListParams, Paginated, Resource } from '@/types/api'
import type {
  CancelSettlement,
  CreditDetail,
  CreditListItem,
  CreditsSummary,
  CustomerCreditFile,
  Debtor,
  Installment,
  InstallmentScheduleItem,
  Repayment,
  RepaymentPayload,
  RepaymentReceipt,
} from '@/types/credits'
import type { ShareLink } from '@/types/sales'
import { http } from './client'

export async function getCreditsSummary(shopId: Id, period: { from?: string; to?: string } = {}): Promise<CreditsSummary> {
  return (await http.get<Resource<CreditsSummary>>(`/shops/${shopId}/credits/summary`, period)).data
}

export function listDebtors(shopId: Id, params: ListParams = {}): Promise<Paginated<Debtor>> {
  return http.get<Paginated<Debtor>>(`/shops/${shopId}/credits/debtors`, params)
}

export function listCredits(shopId: Id, params: ListParams = {}): Promise<Paginated<CreditListItem>> {
  return http.get<Paginated<CreditListItem>>(`/shops/${shopId}/credits`, params)
}

/** Fiche crédit d'un client, sur toutes les boutiques visibles. */
export async function getCustomerCredits(customerId: Id): Promise<CustomerCreditFile> {
  return (await http.get<Resource<CustomerCreditFile>>(`/customers/${customerId}/credits`)).data
}

/** Solde initial : dette existante saisie sans vente (CR-N). */
export async function createOpeningBalance(
  shopId: Id,
  payload: { customer_id: Id; amount: string; occurred_at?: string; note?: string | null },
): Promise<CreditDetail> {
  return (await http.post<Resource<CreditDetail>>(`/shops/${shopId}/credits/opening-balance`, payload)).data
}

/** Annulation avec motif ; si de l'argent a déjà été reçu, choix avoir ou argent rendu (P3). */
export async function cancelCredit(shopId: Id, id: Id, payload: { reason: string } & CancelSettlement): Promise<CreditDetail> {
  return (await http.post<Resource<CreditDetail>>(`/shops/${shopId}/credits/${id}/cancel`, payload)).data
}

export async function adjustCredit(shopId: Id, id: Id, payload: { amount: string; reason: string }): Promise<CreditDetail> {
  return (await http.post<Resource<CreditDetail>>(`/shops/${shopId}/credits/${id}/adjustments`, payload)).data
}

export async function setInstallments(shopId: Id, id: Id, installments: InstallmentScheduleItem[]): Promise<CreditDetail> {
  return (await http.put<Resource<CreditDetail>>(`/shops/${shopId}/credits/${id}/installments`, { installments })).data
}

export type InstallmentListItem = Installment & { credit: { id: Id; reference: string }; customer: { id: Id; name: string; phone: string | null } }

export function listInstallments(shopId: Id, status: 'overdue' | 'upcoming', params: ListParams = {}): Promise<Paginated<InstallmentListItem>> {
  return http.get<Paginated<InstallmentListItem>>(`/shops/${shopId}/installments`, { ...params, status })
}

export async function createRepayment(shopId: Id, payload: RepaymentPayload): Promise<Repayment> {
  return (await http.post<Resource<Repayment>>(`/shops/${shopId}/repayments`, payload)).data
}

export function listRepayments(shopId: Id, params: ListParams = {}): Promise<Paginated<Repayment>> {
  return http.get<Paginated<Repayment>>(`/shops/${shopId}/repayments`, params)
}

export async function getRepayment(shopId: Id, id: Id): Promise<Repayment> {
  return (await http.get<Resource<Repayment>>(`/shops/${shopId}/repayments/${id}`)).data
}

/** Annuler un remboursement libère ses affectations (§7.6). */
export async function cancelRepayment(shopId: Id, id: Id, reason: string): Promise<Repayment> {
  return (await http.post<Resource<Repayment>>(`/shops/${shopId}/repayments/${id}/cancel`, { reason })).data
}

export async function getRepaymentReceipt(shopId: Id, id: Id): Promise<RepaymentReceipt> {
  return (await http.get<Resource<RepaymentReceipt>>(`/shops/${shopId}/repayments/${id}/receipt`)).data
}

export async function createRepaymentShareLink(shopId: Id, id: Id): Promise<ShareLink> {
  return (await http.post<Resource<ShareLink>>(`/shops/${shopId}/repayments/${id}/share-link`)).data
}
