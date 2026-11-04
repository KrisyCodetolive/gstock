// Endpoints du module M10 : clients. Désactivation au lieu de suppression.
import type { Id, ListParams, Paginated, Resource } from '@/types/api'
import type { Customer, CustomerPayload, CustomerSummary } from '@/types/customers'
import { http } from './client'

export function listCustomers(params: ListParams = {}): Promise<Paginated<Customer>> {
  return http.get<Paginated<Customer>>('/customers', params)
}

export async function getCustomer(id: Id): Promise<Customer> {
  return (await http.get<Resource<Customer>>(`/customers/${id}`)).data
}

export async function getCustomerSummary(id: Id): Promise<CustomerSummary> {
  return (await http.get<Resource<CustomerSummary>>(`/customers/${id}/summary`)).data
}

export async function createCustomer(payload: CustomerPayload): Promise<Customer> {
  return (await http.post<Resource<Customer>>('/customers', payload)).data
}

export async function updateCustomer(id: Id, payload: CustomerPayload): Promise<Customer> {
  return (await http.put<Resource<Customer>>(`/customers/${id}`, payload)).data
}
