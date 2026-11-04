// Outils communs aux handlers : session, permissions, validation, pagination.
// Ils reproduisent les réponses du serveur (§9).
import { HttpResponse } from 'msw'
import type { Permission } from '@/types/auth'
import { db } from './db'
import { currentUser } from './session'
import type { MockUser } from './data/users'

export const API = '/api/v1'

/** Réponse d'erreur, levée par les gardes et attrapée par `handle`. */
export class MockHttpError {
  readonly response: Response
  readonly message: string
  readonly errors: Record<string, string[]>
  constructor(status: number, message: string, errors?: Record<string, string[]>) {
    this.message = message
    this.errors = errors ?? {}
    this.response = HttpResponse.json(errors ? { message, errors } : { message }, { status })
  }
}

/** Exécute un handler et transforme les gardes levées en réponses HTTP. */
export async function handle(fn: () => Response | Promise<Response>): Promise<Response> {
  try {
    return await fn()
  } catch (error) {
    if (error instanceof MockHttpError) return error.response
    throw error
  }
}

/** 401 sans session. */
export function requireUser(): MockUser {
  const user = currentUser()
  if (!user) throw new MockHttpError(401, 'Votre session a expiré. Reconnectez-vous.')
  return user
}

export function permissionsOf(user: MockUser): Permission[] {
  return db.roles.find((r) => r.id === user.role_id)?.permissions ?? []
}

export function isOwner(user: MockUser): boolean {
  return db.roles.find((r) => r.id === user.role_id)?.is_owner ?? false
}

/** 403 si aucune des permissions n'est accordée (contrôle serveur, §6.2). */
export function requirePermission(...permissions: Permission[]): MockUser {
  const user = requireUser()
  const granted = permissionsOf(user)
  if (!permissions.some((p) => granted.includes(p))) {
    throw new MockHttpError(403, "Vous n'avez pas accès à cette action.")
  }
  return user
}

/** Accumule les erreurs de validation, puis lève un 422 s'il y en a. */
export class Validator {
  private errors: Record<string, string[]> = {}

  add(field: string, message: string) {
    ;(this.errors[field] ??= []).push(message)
  }

  check(condition: boolean, field: string, message: string) {
    if (!condition) this.add(field, message)
  }

  required(value: unknown, field: string, message: string) {
    this.check(typeof value === 'string' ? value.trim() !== '' : value !== null && value !== undefined, field, message)
  }

  done() {
    if (Object.keys(this.errors).length) {
      throw new MockHttpError(422, 'Les informations saisies ne sont pas valides.', this.errors)
    }
  }
}

export function notFound(): never {
  throw new MockHttpError(404, "Cet élément n'existe pas ou a été retiré.")
}

export function findOr404<T extends { id: number }>(rows: T[], id: unknown): T {
  return rows.find((r) => r.id === Number(id)) ?? notFound()
}

/** Normalise une saisie facultative : chaîne vide → null. */
export function nullable(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/** Recherche, tri, filtres et pagination d'une liste (§9). */
export function paginate<T extends object>(
  request: Request,
  rows: T[],
  options: { searchIn?: (row: T) => string; filters?: Record<string, (row: T, value: string) => boolean> } = {},
) {
  const url = new URL(request.url)
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
  const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get('per_page') ?? 20)))
  const search = url.searchParams.get('search')?.trim().toLowerCase()
  const sort = url.searchParams.get('sort')

  let result = rows
  if (search && options.searchIn) {
    const needle = normalize(search)
    result = result.filter((row) => normalize(options.searchIn!(row)).includes(needle))
  }
  for (const [name, test] of Object.entries(options.filters ?? {})) {
    const value = url.searchParams.get(`filter[${name}]`)
    if (value !== null && value !== '') result = result.filter((row) => test(row, value))
  }
  if (sort) {
    const desc = sort.startsWith('-')
    const field = (desc ? sort.slice(1) : sort) as keyof T
    result = [...result].sort((a, b) => {
      const cmp = String(a[field] ?? '').localeCompare(String(b[field] ?? ''), 'fr', { numeric: true })
      return desc ? -cmp : cmp
    })
  }

  const total = result.length
  return HttpResponse.json({
    data: result.slice((page - 1) * perPage, page * perPage),
    meta: { current_page: page, per_page: perPage, total, last_page: Math.max(1, Math.ceil(total / perPage)) },
  })
}

/** Comparaison sans accents ni majuscules, pour la recherche et l'unicité. */
export function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}
