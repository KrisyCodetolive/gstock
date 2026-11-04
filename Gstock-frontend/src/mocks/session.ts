// Session simulée : garde l'utilisateur connecté entre deux rechargements,
// comme le ferait le cookie Sanctum.
import type { Me } from '@/types/auth'
import { db } from './db'
import type { MockUser } from './data/users'

const KEY = 'gstock.mock.session'

export function startSession(userId: number) {
  localStorage.setItem(KEY, String(userId))
}

export function endSession() {
  localStorage.removeItem(KEY)
}

/** Un utilisateur désactivé perd sa session (§6.2). */
export function currentUser(): MockUser | undefined {
  const id = Number(localStorage.getItem(KEY))
  const user = db.users.find((u) => u.id === id)
  return user?.is_active ? user : undefined
}

export function toMe(user: MockUser): Me {
  const role = db.roles.find((r) => r.id === user.role_id)
  if (!role) throw new Error(`Rôle ${user.role_id} introuvable`)
  // Une boutique désactivée n'apparaît plus dans le sélecteur (M03).
  const activeShops = db.shops.filter((s) => s.is_active)
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
    shops: (role.is_owner ? activeShops : activeShops.filter((s) => user.shop_ids.includes(s.id))).map((s) => ({
      id: s.id,
      name: s.name,
      city: s.city,
      district: s.district,
    })),
    tenant: {
      name: db.settings.name,
      currency: db.settings.currency,
      timezone: db.settings.timezone,
      advanced_mode: db.settings.advanced_mode,
    },
  }
}
