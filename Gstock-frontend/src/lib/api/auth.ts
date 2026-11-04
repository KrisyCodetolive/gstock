// Endpoints du module M02 (authentification et profil).
import type { Resource } from '@/types/api'
import type {
  ForgotPasswordPayload,
  ForgotPasswordResult,
  LoginPayload,
  Me,
  PasswordChangePayload,
  ProfilePayload,
  ResetPasswordPayload,
} from '@/types/auth'
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

export async function forgotPassword(payload: ForgotPasswordPayload): Promise<ForgotPasswordResult> {
  await ensureCsrfCookie()
  const res = await http.post<Resource<ForgotPasswordResult>>('/auth/forgot-password', payload)
  return res.data
}

export async function resetPassword(payload: ResetPasswordPayload): Promise<void> {
  await ensureCsrfCookie()
  await http.post<void>('/auth/reset-password', payload)
}

export async function updateProfile(payload: ProfilePayload): Promise<Me> {
  const res = await http.put<Resource<Me>>('/me', payload)
  return res.data
}

export async function changePassword(payload: PasswordChangePayload): Promise<void> {
  await http.put<void>('/me/password', payload)
}

/** Photo de profil, déjà réduite sur l'appareil (champ multipart `avatar`). */
export async function uploadAvatar(file: File): Promise<Me> {
  const form = new FormData()
  form.append('avatar', file)
  const res = await http.upload<Resource<Me>>('/me/avatar', form)
  return res.data
}

export async function deleteAvatar(): Promise<Me> {
  const res = await http.delete<Resource<Me>>('/me/avatar')
  return res.data
}
