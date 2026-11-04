// Endpoints simulés du module M02, mêmes règles que le serveur.
import { delay, http, HttpResponse } from 'msw'
import type {
  ForgotPasswordPayload,
  LoginPayload,
  PasswordChangePayload,
  ProfilePayload,
  ResetPasswordPayload,
} from '@/types/auth'
import { audit } from '../audit'
import { db, persist } from '../db'
import { API, EMAIL, handle, MockHttpError, normalizePhone, nullable, readImage, requireUser, Validator } from '../http'
import { currentTenant, platform } from '../platform'
import { endSession, startSession, toMe } from '../session'

/** Durée de validité d'un lien de réinitialisation (Laravel : 60 minutes). */
const RESET_TTL_MS = 60 * 60_000

interface ResetToken {
  token: string
  user_id: number
  expires_at: string
}

// Jetons de réinitialisation, par espace (table `password_reset_tokens` côté serveur).
const resetKey = () => `gstock.mock.reset.${platform.current}`
const readTokens = (): ResetToken[] => JSON.parse(localStorage.getItem(resetKey()) ?? '[]') as ResetToken[]
const writeTokens = (tokens: ResetToken[]) => localStorage.setItem(resetKey(), JSON.stringify(tokens))

const FORGOT_MESSAGE =
  "Si un compte utilise cette adresse, un lien pour choisir un nouveau mot de passe vient d'y être envoyé. Il est valable 60 minutes."

function checkNewPassword(v: Validator, password: string, confirmation: string) {
  v.check(password.length >= 8, 'password', 'Le mot de passe doit contenir au moins 8 caractères.')
  v.check(password === confirmation, 'password_confirmation', 'Les deux mots de passe ne sont pas identiques.')
}

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
      // Espace fermé par Genius Groups : plus de connexion (M02). Un espace suspendu reste consultable.
      if (currentTenant().closed) {
        const message = 'Cet espace est fermé. Contactez le support GStock.'
        throw new MockHttpError(422, message, { login: [message] })
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

  // Mot de passe oublié : même réponse que le compte existe ou non (pas d'énumération).
  // Le serveur limite le nombre de demandes et envoie l'e-mail par la file de tâches.
  http.post(`${API}/auth/forgot-password`, ({ request }) =>
    handle(async () => {
      await delay(400)
      const { email = '' } = (await request.json()) as Partial<ForgotPasswordPayload>
      const value = email.trim().toLowerCase()
      const v = new Validator()
      v.required(value, 'email', 'Saisissez votre adresse e-mail.')
      if (value) v.check(EMAIL.test(value), 'email', "Cette adresse e-mail n'est pas valide.")
      v.done()

      const user = db.users.find((u) => u.email === value && u.is_active)
      if (!user) return HttpResponse.json({ data: { message: FORGOT_MESSAGE } })

      // Un nouveau lien remplace le précédent.
      const token = crypto.randomUUID()
      const expires_at = new Date(Date.now() + RESET_TTL_MS).toISOString()
      writeTokens([...readTokens().filter((t) => t.user_id !== user.id), { token, user_id: user.id, expires_at }])
      return HttpResponse.json({
        data: { message: FORGOT_MESSAGE, demo_reset_url: `/reinitialiser-mot-de-passe?jeton=${token}` },
      })
    }),
  ),

  http.post(`${API}/auth/reset-password`, ({ request }) =>
    handle(async () => {
      await delay(400)
      const body = (await request.json()) as Partial<ResetPasswordPayload>
      const tokens = readTokens()
      const entry = tokens.find((t) => t.token === body.token)
      const user = entry && db.users.find((u) => u.id === entry.user_id)
      if (!entry || !user || !user.is_active || new Date(entry.expires_at).getTime() < Date.now()) {
        throw new MockHttpError(422, 'Ce lien a expiré ou a déjà servi. Demandez-en un nouveau.')
      }
      const v = new Validator()
      checkNewPassword(v, body.password ?? '', body.password_confirmation ?? '')
      v.done()

      user.password = body.password!
      audit(user, 'user.password_reset', { subject: { type: 'user', id: user.id, label: `${user.firstname} ${user.lastname}` } })
      persist()
      // Le lien ne sert qu'une fois, et les sessions ouvertes avec l'ancien mot de passe sont fermées.
      writeTokens(tokens.filter((t) => t !== entry))
      endSession()
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  http.get(`${API}/me`, () =>
    handle(async () => {
      await delay(250)
      return HttpResponse.json({ data: toMe(requireUser()) })
    }),
  ),

  // Profil : chacun modifie son propre compte, sans permission particulière.
  // Le rôle et les boutiques restent gérés par le propriétaire (M04).
  http.put(`${API}/me`, ({ request }) =>
    handle(async () => {
      await delay(300)
      const user = requireUser()
      const body = (await request.json()) as Partial<ProfilePayload>
      const email = nullable(body.email)?.toLowerCase() ?? null
      const phone = nullable(body.phone) ? normalizePhone(body.phone!) : null

      const v = new Validator()
      v.required(body.firstname ?? '', 'firstname', 'Saisissez votre prénom.')
      v.required(body.lastname ?? '', 'lastname', 'Saisissez votre nom.')
      v.check(Boolean(email || phone), 'email', 'Gardez un e-mail ou un numéro de téléphone pour vous connecter.')
      if (email) {
        v.check(EMAIL.test(email), 'email', "Cette adresse e-mail n'est pas valide.")
        v.check(!db.users.some((u) => u.id !== user.id && u.email === email), 'email', 'Cet e-mail est déjà utilisé par un autre utilisateur.')
      }
      if (phone) {
        v.check(/^\d{8,12}$/.test(phone), 'phone', "Ce numéro de téléphone n'est pas valide.")
        v.check(!db.users.some((u) => u.id !== user.id && u.phone === phone), 'phone', 'Ce numéro est déjà utilisé par un autre utilisateur.')
      }
      v.done()

      user.firstname = body.firstname!.trim()
      user.lastname = body.lastname!.trim()
      user.email = email
      user.phone = phone
      persist()
      return HttpResponse.json({ data: toMe(user) })
    }),
  ),

  http.put(`${API}/me/password`, ({ request }) =>
    handle(async () => {
      await delay(400)
      const user = requireUser()
      const body = (await request.json()) as Partial<PasswordChangePayload>
      const v = new Validator()
      v.check(body.current_password === user.password, 'current_password', 'Le mot de passe actuel est incorrect.')
      checkNewPassword(v, body.password ?? '', body.password_confirmation ?? '')
      if (body.password && body.password === user.password) v.add('password', "Choisissez un mot de passe différent de l'actuel.")
      v.done()

      user.password = body.password!
      audit(user, 'user.password_changed', { subject: { type: 'user', id: user.id, label: `${user.firstname} ${user.lastname}` } })
      persist()
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  http.post(`${API}/me/avatar`, ({ request }) =>
    handle(async () => {
      await delay(400)
      const user = requireUser()
      user.avatar_url = await readImage(request, 'avatar')
      persist()
      return HttpResponse.json({ data: toMe(user) })
    }),
  ),

  http.delete(`${API}/me/avatar`, () =>
    handle(async () => {
      await delay(200)
      const user = requireUser()
      user.avatar_url = null
      persist()
      return HttpResponse.json({ data: toMe(user) })
    }),
  ),
]
