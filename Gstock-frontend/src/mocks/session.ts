// Session simulée : garde l'utilisateur connecté entre deux rechargements,
// comme le ferait le cookie Sanctum.
import { HttpResponse } from 'msw'
import type { Me } from '@/types/auth'
import { shops, tenant } from './data/tenant'
import { roles, users, type MockUser } from './data/users'

const KEY = 'gstock.mock.session'

export function startSession(userId: number) {
  localStorage.setItem(KEY, String(userId))
}

export function endSession() {
  localStorage.removeItem(KEY)
}

export function currentUser(): MockUser | undefined {
  const id = Number(localStorage.getItem(KEY))
  const user = users.find((u) => u.id === id)
  return user?.is_active ? user : undefined
}

export function toMe(user: MockUser): Me {
  const role = roles.find((r) => r.id === user.role_id)
  if (!role) throw new Error(`Rôle ${user.role_id} introuvable`)
  return {
    user: {
      id: user.id,
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      phone: user.phone,
      avatar_url: user.avatar_url,
    },
    role: { id: role.id, name: role.name, is_owner: role.is_owner },
    permissions: [...role.permissions],
    shops: role.is_owner ? shops : shops.filter((s) => user.shop_ids.includes(s.id)),
    tenant,
  }
}

export function unauthenticated() {
  return HttpResponse.json({ message: 'Votre session a expiré. Reconnectez-vous.' }, { status: 401 })
}
