// Endpoints du module M03 : paramètres de l'espace et paiements en ligne.
import type { Resource } from '@/types/api'
import type {
  PaymentSettings,
  PaymentSettingsPayload,
  PaymentTestResult,
  TenantSettings,
  TenantSettingsPayload,
} from '@/types/settings'
import { http } from './client'

export async function getSettings(): Promise<TenantSettings> {
  return (await http.get<Resource<TenantSettings>>('/settings')).data
}

export async function updateSettings(payload: TenantSettingsPayload): Promise<TenantSettings> {
  return (await http.put<Resource<TenantSettings>>('/settings', payload)).data
}

export async function getPaymentSettings(): Promise<PaymentSettings> {
  return (await http.get<Resource<PaymentSettings>>('/settings/payment')).data
}

export async function updatePaymentSettings(payload: PaymentSettingsPayload): Promise<PaymentSettings> {
  return (await http.put<Resource<PaymentSettings>>('/settings/payment', payload)).data
}

export async function testPaymentSettings(): Promise<PaymentTestResult> {
  return (await http.post<Resource<PaymentTestResult>>('/settings/payment/test')).data
}
