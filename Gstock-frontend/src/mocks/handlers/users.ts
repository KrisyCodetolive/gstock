// Endpoints simulés des utilisateurs (M04), mêmes règles que le serveur.
import { delay, http, HttpResponse } from 'msw'
import type { UserDetail, UserPayload } from '@/types/users'
import type { MockUser } from '../data/users'
import { db, nextId, persist } from '../db'
import {
  API,
  findOr404,
  handle,
  isOwner,
  MockHttpError,
  nullable,
  paginate,
  requirePermission,
  Validator,
} from '../http'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const normalizePhone = (value: string) => value.replace(/[\s.-]/g, '').replace(/^\+225/, '')

function toResource(user: MockUser): UserDetail {
  const role = db.roles.find((r) => r.id === user.role_id)!
  const owner = role.is_owner
  return {
    id: user.id,
    firstname: user.firstname,
    lastname: user.lastname,
    email: user.email,
    phone: user.phone,
    avatar_url: user.avatar_url,
    role: { id: role.id, name: role.name, is_owner: role.is_owner },
    // Le propriétaire a accès à toutes les boutiques (§6.2).
    shops: db.shops
      .filter((s) => owner || user.shop_ids.includes(s.id))
      .map((s) => ({ id: s.id, name: s.name, city: s.city, district: s.district })),
    is_active: user.is_active,
    last_login_at: user.last_login_at,
  }
}

/** Le compte du propriétaire n'est modifiable par personne d'autre que lui (§6.2). */
function refuseOwnerTarget(target: MockUser, actor: MockUser) {
  if (isOwner(target) && target.id !== actor.id) {
    throw new MockHttpError(403, 'Le compte du propriétaire ne peut pas être modifié par un autre utilisateur.')
  }
}

function validate(body: Partial<UserPayload>, current?: MockUser) {
  const v = new Validator()
  v.required(body.firstname, 'firstname', 'Saisissez le prénom.')
  v.required(body.lastname, 'lastname', 'Saisissez le nom.')

  const email = nullable(body.email)?.toLowerCase() ?? null
  const phone = nullable(body.phone) ? normalizePhone(body.phone!) : null
  v.check(Boolean(email || phone), 'email', 'Saisissez un e-mail ou un numéro de téléphone pour la connexion.')
  if (email) {
    v.check(EMAIL.test(email), 'email', "Cette adresse e-mail n'est pas valide.")
    v.check(!db.users.some((u) => u.id !== current?.id && u.email === email), 'email', 'Cet e-mail est déjà utilisé par un autre utilisateur.')
  }
  if (phone) {
    v.check(/^\d{8,12}$/.test(phone), 'phone', "Ce numéro de téléphone n'est pas valide.")
    v.check(!db.users.some((u) => u.id !== current?.id && u.phone === phone), 'phone', 'Ce numéro est déjà utilisé par un autre utilisateur.')
  }

  const role = db.roles.find((r) => r.id === Number(body.role_id))
  const keepsOwnerRole = current && isOwner(current) && role?.is_owner
  if (!role) v.add('role_id', 'Choisissez un rôle.')
  else if (role.is_owner && !keepsOwnerRole) v.add('role_id', 'Le rôle du propriétaire est réservé au créateur de l’espace.')
  else if (current && isOwner(current) && !role.is_owner) v.add('role_id', 'Le propriétaire garde son rôle.')

  if (!current) v.check((body.password ?? '').length >= 8, 'password', 'Le mot de passe doit contenir au moins 8 caractères.')
  else if (body.password) v.check(body.password.length >= 8, 'password', 'Le mot de passe doit contenir au moins 8 caractères.')

  if (!current && db.users.length >= db.planLimits.max_users) {
    v.add('firstname', `Votre abonnement permet ${db.planLimits.max_users} utilisateurs au maximum.`)
  }
  v.done()
  return { email, phone, role_id: role!.id }
}

export const usersHandlers = [
  http.get(`${API}/users`, ({ request }) =>
    handle(async () => {
      await delay(300)
      requirePermission('users.manage', 'shops.manage')
      return paginate(request, db.users.map(toResource), {
        searchIn: (u) => `${u.firstname} ${u.lastname} ${u.email ?? ''} ${u.phone ?? ''}`,
        filters: {
          role_id: (u, v) => u.role.id === Number(v),
          shop_id: (u, v) => u.shops.some((s) => s.id === Number(v)),
          is_active: (u, v) => String(u.is_active) === v,
        },
      })
    }),
  ),

  http.get(`${API}/users/:id`, ({ params }) =>
    handle(async () => {
      await delay(250)
      requirePermission('users.manage')
      return HttpResponse.json({ data: toResource(findOr404(db.users, params.id)) })
    }),
  ),

  http.post(`${API}/users`, ({ request }) =>
    handle(async () => {
      await delay(400)
      requirePermission('users.manage')
      const body = (await request.json()) as Partial<UserPayload>
      const clean = validate(body)
      const user: MockUser = {
        id: nextId(db.users),
        firstname: body.firstname!.trim(),
        lastname: body.lastname!.trim(),
        ...clean,
        avatar_url: null,
        password: body.password!,
        // Sans affectation, aucun accès : les boutiques se donnent ensuite (PUT /users/{id}/shops).
        shop_ids: [],
        is_active: true,
        last_login_at: null,
      }
      db.users.push(user)
      persist()
      return HttpResponse.json({ data: toResource(user) }, { status: 201 })
    }),
  ),

  http.put(`${API}/users/:id`, ({ request, params }) =>
    handle(async () => {
      await delay(400)
      const actor = requirePermission('users.manage')
      const user = findOr404(db.users, params.id)
      refuseOwnerTarget(user, actor)
      const body = (await request.json()) as Partial<UserPayload>
      const clean = validate(body, user)
      Object.assign(user, {
        firstname: body.firstname!.trim(),
        lastname: body.lastname!.trim(),
        ...clean,
        ...(body.password ? { password: body.password } : {}),
      })
      persist()
      return HttpResponse.json({ data: toResource(user) })
    }),
  ),

  http.patch(`${API}/users/:id/status`, ({ request, params }) =>
    handle(async () => {
      await delay(350)
      const actor = requirePermission('users.manage')
      const user = findOr404(db.users, params.id)
      if (isOwner(user)) throw new MockHttpError(403, 'Le compte du propriétaire ne peut pas être désactivé.')
      if (user.id === actor.id) throw new MockHttpError(403, 'Vous ne pouvez pas désactiver votre propre compte.')
      const { is_active } = (await request.json()) as { is_active: boolean }
      // Désactivé : ses sessions sont révoquées (currentUser() le refuse).
      user.is_active = Boolean(is_active)
      persist()
      return HttpResponse.json({ data: toResource(user) })
    }),
  ),

  http.put(`${API}/users/:id/shops`, ({ request, params }) =>
    handle(async () => {
      await delay(350)
      const actor = requirePermission('users.manage')
      const user = findOr404(db.users, params.id)
      refuseOwnerTarget(user, actor)
      const { shop_ids = [] } = (await request.json()) as { shop_ids?: number[] }
      const v = new Validator()
      v.check(shop_ids.every((id) => db.shops.some((s) => s.id === id)), 'shop_ids', 'Une boutique choisie n’existe pas.')
      v.done()
      user.shop_ids = [...new Set(shop_ids)]
      persist()
      return HttpResponse.json({ data: toResource(user) })
    }),
  ),
]
