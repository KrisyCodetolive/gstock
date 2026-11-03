// Endpoints simulés du module M02, mêmes règles que le serveur.
import { delay, http, HttpResponse } from 'msw'
import type { LoginPayload } from '@/types/auth'
import { db, persist } from '../db'
import { API, handle, MockHttpError, requireUser, Validator } from '../http'
import { endSession, startSession, toMe } from '../session'

const normalizePhone = (value: string) => value.replace(/[\s.-]/g, '').replace(/^\+225/, '')

export const authHandlers = [
  http.get('/sanctum/csrf-cookie', () => new HttpResponse(null, { status: 204 })),

  http.post(`${API}/auth/login`, ({ request }) =>
    handle(async () => {
      await delay(400)
      const { login = '', password = '' } = (await request.json()) as Partial<LoginPayload>

      const v = new Validator()
      v.required(login, 'login', 'Saisissez votre e-mail ou votre numéro de téléphone.')
      v.required(password, 'password', 'Saisissez votre mot de passe.')
      v.done()

      const value = login.trim().toLowerCase()
      const user = db.users.find((u) => u.email === value || (u.phone && u.phone === normalizePhone(value)))

      if (!user || user.password !== password) {
        throw new MockHttpError(422, 'Identifiants incorrects.', {
          login: ['E-mail, téléphone ou mot de passe incorrect.'],
        })
      }
      if (!user.is_active) {
        const message = 'Ce compte est désactivé. Demandez au propriétaire de la boutique de le réactiver.'
        throw new MockHttpError(422, message, { login: [message] })
      }

      user.last_login_at = new Date().toISOString()
      persist()
      startSession(user.id)
      return HttpResponse.json({ data: toMe(user) })
    }),
  ),

  http.post(`${API}/auth/logout`, async () => {
    await delay(150)
    endSession()
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(`${API}/me`, () =>
    handle(async () => {
      await delay(250)
      return HttpResponse.json({ data: toMe(requireUser()) })
    }),
  ),
]
