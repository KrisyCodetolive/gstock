// Endpoints simulés du module M02, mêmes règles que le serveur.
import { delay, http, HttpResponse } from 'msw'
import type { LoginPayload } from '@/types/auth'
import { users } from '../data/users'
import { currentUser, endSession, startSession, toMe, unauthenticated } from '../session'

const API = '/api/v1'

const normalizePhone = (value: string) => value.replace(/[\s.-]/g, '').replace(/^\+225/, '')

export const authHandlers = [
  http.get('/sanctum/csrf-cookie', () => new HttpResponse(null, { status: 204 })),

  http.post(`${API}/auth/login`, async ({ request }) => {
    await delay(400)
    const { login = '', password = '' } = (await request.json()) as Partial<LoginPayload>

    const errors: Record<string, string[]> = {}
    if (!login.trim()) errors.login = ['Saisissez votre e-mail ou votre numéro de téléphone.']
    if (!password) errors.password = ['Saisissez votre mot de passe.']
    if (Object.keys(errors).length) {
      return HttpResponse.json({ message: 'Les informations saisies ne sont pas valides.', errors }, { status: 422 })
    }

    const value = login.trim().toLowerCase()
    const user = users.find((u) => u.email === value || (u.phone && u.phone === normalizePhone(value)))

    if (!user || user.password !== password) {
      return HttpResponse.json(
        {
          message: 'Identifiants incorrects.',
          errors: { login: ['E-mail, téléphone ou mot de passe incorrect.'] },
        },
        { status: 422 },
      )
    }
    if (!user.is_active) {
      return HttpResponse.json(
        {
          message: 'Ce compte est désactivé. Demandez au propriétaire de la boutique de le réactiver.',
          errors: { login: ['Ce compte est désactivé. Demandez au propriétaire de la boutique de le réactiver.'] },
        },
        { status: 422 },
      )
    }

    startSession(user.id)
    return HttpResponse.json({ data: toMe(user) })
  }),

  http.post(`${API}/auth/logout`, async () => {
    await delay(150)
    endSession()
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(`${API}/me`, async () => {
    await delay(250)
    const user = currentUser()
    return user ? HttpResponse.json({ data: toMe(user) }) : unauthenticated()
  }),
]
