// Endpoints du module M02 (authentification et profil).
import type { Resource } from '@/types/api'
import type { LoginPayload, Me } from '@/types/auth'
import { ensureCsrfCookie, http } from './client'

export async function login(payload: LoginPayload): Promise<Me> {
  await ensureCsrfCookie()
  const res = await http.post<Resource<Me>>('/auth/login', payload)
  return res.data
}

export async function logout(): Promise<void> {
  await http.post<void>('/auth/logout')
}

export async function getMe(): Promise<Me> {
  const res = await http.get<Resource<Me>>('/me')
  return res.data
}
