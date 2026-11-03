// Endpoints simulés des rôles et permissions (M04, ADR-014).
import { delay, http, HttpResponse } from 'msw'
import { ALL_PERMISSIONS, type Permission } from '@/types/auth'
import type { RoleDetail, RolePayload } from '@/types/users'
import { permissionDefinitions } from '../data/permissions'
import type { MockRole } from '../data/users'
import { db, nextId, persist } from '../db'
import { API, findOr404, handle, MockHttpError, normalize, nullable, paginate, requirePermission, Validator } from '../http'

const usersCount = (roleId: number) => db.users.filter((u) => u.role_id === roleId).length

const toResource = (role: MockRole): RoleDetail => ({ ...role, users_count: usersCount(role.id) })

function validate(body: Partial<RolePayload>, current?: MockRole) {
  const v = new Validator()
  v.required(body.name, 'name', 'Donnez un nom au rôle.')
  if (body.name) {
    const name = normalize(body.name)
    v.check(name !== 'owner' && name !== 'proprietaire', 'name', 'Ce nom est réservé au rôle du propriétaire.')
    v.check(!db.roles.some((r) => r.id !== current?.id && normalize(r.name) === name), 'name', 'Un autre rôle porte déjà ce nom.')
  }
  const perms = body.permissions ?? []
  v.check(perms.length > 0, 'permissions', 'Cochez au moins une permission.')
  v.check(perms.every((p) => (ALL_PERMISSIONS as readonly string[]).includes(p)), 'permissions', 'Une permission inconnue a été envoyée.')
  v.done()
}

/** Le rôle Owner ne peut être ni modifié ni supprimé. */
function refuseOwner(role: MockRole) {
  if (role.is_owner) throw new MockHttpError(403, 'Le rôle du propriétaire ne peut être ni modifié ni supprimé.')
}

export const rolesHandlers = [
  http.get(`${API}/permissions`, () =>
    handle(async () => {
      await delay(200)
      requirePermission('roles.manage')
      return HttpResponse.json({ data: permissionDefinitions })
    }),
  ),

  http.get(`${API}/roles`, ({ request }) =>
    handle(async () => {
      await delay(300)
      requirePermission('roles.manage', 'users.manage')
      // Owner en tête, puis ordre alphabétique.
      const rows = [...db.roles].sort((a, b) => Number(b.is_owner) - Number(a.is_owner) || a.name.localeCompare(b.name, 'fr'))
      return paginate(request, rows.map(toResource), { searchIn: (r) => `${r.name} ${r.description ?? ''}` })
    }),
  ),

  http.get(`${API}/roles/:id`, ({ params }) =>
    handle(async () => {
      await delay(250)
      requirePermission('roles.manage')
      return HttpResponse.json({ data: toResource(findOr404(db.roles, params.id)) })
    }),
  ),

  http.post(`${API}/roles`, ({ request }) =>
    handle(async () => {
      await delay(400)
      requirePermission('roles.manage')
      const body = (await request.json()) as Partial<RolePayload>
      validate(body)
      const role: MockRole = {
        id: nextId(db.roles),
        name: body.name!.trim(),
        description: nullable(body.description),
        is_owner: false,
        permissions: [...new Set(body.permissions)] as Permission[],
      }
      db.roles.push(role)
      persist()
      return HttpResponse.json({ data: toResource(role) }, { status: 201 })
    }),
  ),

  http.put(`${API}/roles/:id`, ({ request, params }) =>
    handle(async () => {
      await delay(400)
      requirePermission('roles.manage')
      const role = findOr404(db.roles, params.id)
      refuseOwner(role)
      const body = (await request.json()) as Partial<RolePayload>
      validate(body, role)
      // S'applique immédiatement à tous les utilisateurs du rôle (M04).
      Object.assign(role, {
        name: body.name!.trim(),
        description: nullable(body.description),
        permissions: [...new Set(body.permissions)],
      })
      persist()
      return HttpResponse.json({ data: toResource(role) })
    }),
  ),

  http.delete(`${API}/roles/:id`, ({ params }) =>
    handle(async () => {
      await delay(350)
      requirePermission('roles.manage')
      const role = findOr404(db.roles, params.id)
      refuseOwner(role)
      const count = usersCount(role.id)
      if (count > 0) {
        throw new MockHttpError(
          409,
          `Ce rôle est attribué à ${count} utilisateur${count > 1 ? 's' : ''}. Donnez-leur un autre rôle avant de le supprimer.`,
        )
      }
      db.roles.splice(db.roles.indexOf(role), 1)
      persist()
      return new HttpResponse(null, { status: 204 })
    }),
  ),
]
