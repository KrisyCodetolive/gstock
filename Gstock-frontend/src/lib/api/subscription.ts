// Endpoints du module M00 : inscription (domaine principal), abonnement, assistant de démarrage.
import type { ListParams, Paginated, Resource } from '@/types/api'
import type { Me } from '@/types/auth'
import type {
  CheckoutPayload,
  CheckoutResult,
  Invoice,
  Onboarding,
  OnboardingStepId,
  Plan,
  RegisterPayload,
  RegisterResult,
  SlugCheck,
  Subscription,
} from '@/types/subscription'
import { ensureCsrfCookie, http } from './client'

export async function listPlans(): Promise<Plan[]> {
  const res = await http.get<Resource<Plan[]>>('/plans')
  return res.data
}

export async function checkSlug(slug: string, signal?: AbortSignal): Promise<SlugCheck> {
  const res = await http.get<Resource<SlugCheck>>('/register/check-slug', { slug }, signal)
  return res.data
}

export async function register(payload: RegisterPayload): Promise<RegisterResult> {
  await ensureCsrfCookie()
  const res = await http.post<Resource<RegisterResult>>('/register', payload)
  return res.data
}

/** Échange le lien de connexion à usage unique (reçu à l'inscription) contre une session. */
export async function tokenLogin(token: string): Promise<Me> {
  await ensureCsrfCookie()
  const res = await http.post<Resource<Me>>('/auth/token-login', { token })
  return res.data
}

export async function getSubscription(): Promise<Subscription> {
  const res = await http.get<Resource<Subscription>>('/subscription')
  return res.data
}

export function listInvoices(params: ListParams = {}): Promise<Paginated<Invoice>> {
  return http.get<Paginated<Invoice>>('/subscription/invoices', params)
}

export async function checkout(payload: CheckoutPayload): Promise<CheckoutResult> {
  const res = await http.post<Resource<CheckoutResult>>('/subscription/checkout', payload)
  return res.data
}

export async function getOnboarding(): Promise<Onboarding> {
  const res = await http.get<Resource<Onboarding>>('/onboarding')
  return res.data
}

export async function skipOnboardingStep(step: OnboardingStepId): Promise<Onboarding> {
  const res = await http.post<Resource<Onboarding>>(`/onboarding/steps/${step}/skip`)
  return res.data
}

export async function dismissOnboarding(): Promise<Onboarding> {
  const res = await http.post<Resource<Onboarding>>('/onboarding/dismiss')
  return res.data
}
