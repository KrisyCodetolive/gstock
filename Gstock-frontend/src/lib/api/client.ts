// Seul fichier de l'application qui fait des appels HTTP (cahier §11.2).
// Pour changer d'URL, d'authentification ou de bibliothèque HTTP, c'est ici.
import type { ApiErrorBody, ListParams } from '@/types/api'

const API_URL = import.meta.env.VITE_API_URL ?? '/api/v1'
/** Point d'entrée Sanctum, hors du préfixe /api/v1 (ADR-008). */
const CSRF_URL = import.meta.env.VITE_CSRF_URL ?? '/sanctum/csrf-cookie'

/** Erreur typée renvoyée par toutes les fonctions de lib/api. */
export class ApiError extends Error {
  readonly status: number
  /** Erreurs par champ (422), messages déjà en français. */
  readonly errors: Record<string, string[]>

  constructor(status: number, body: Partial<ApiErrorBody>) {
    super(body.message ?? defaultMessage(status))
    this.name = 'ApiError'
    this.status = status
    this.errors = body.errors ?? {}
  }

  /** Premier message d'erreur d'un champ, pour l'afficher sous le champ. */
  fieldError(field: string): string | undefined {
    return this.errors[field]?.[0]
  }
}

function defaultMessage(status: number): string {
  switch (status) {
    case 0:
      return 'Impossible de joindre le serveur. Vérifiez votre connexion internet.'
    case 401:
      return 'Votre session a expiré. Reconnectez-vous.'
    case 402:
      return "Votre abonnement est suspendu : l'espace est en lecture seule."
    case 403:
      return "Vous n'avez pas accès à cette page."
    case 404:
      return "Cet élément n'existe pas ou a été retiré."
    case 409:
      return 'Cette opération a déjà été traitée.'
    case 422:
      return 'Les informations saisies ne sont pas valides.'
    default:
      return 'Une erreur est survenue. Réessayez dans un instant.'
  }
}

let onUnauthorized: (() => void) | undefined
let onReachability: ((reachable: boolean) => void) | undefined

/** Appelé après chaque requête : le serveur a répondu (true) ou est injoignable (false). */
export function setReachabilityHandler(handler: (reachable: boolean) => void) {
  onReachability = handler
}

/** Appelé quand le serveur répond 401 (session expirée), hors connexion. */
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler
}

type Query = ListParams | Record<string, string | number | boolean | undefined>

function toSearchParams(query: Query): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '') continue
    if (key === 'filter' && typeof value === 'object') {
      for (const [field, v] of Object.entries(value)) {
        if (v !== undefined && v !== '') params.append(`filter[${field}]`, String(v))
      }
    } else {
      params.append(key, String(value))
    }
  }
  const s = params.toString()
  return s ? `?${s}` : ''
}

function readCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match?.[1] ? decodeURIComponent(match[1]) : undefined
}

interface RequestOptions {
  body?: unknown
  query?: Query
  signal?: AbortSignal
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  }
  const xsrf = readCookie('XSRF-TOKEN')
  if (xsrf) headers['X-XSRF-TOKEN'] = xsrf
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}${options.query ? toSearchParams(options.query) : ''}`, {
      method,
      headers,
      credentials: 'include',
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    onReachability?.(false)
    throw new ApiError(0, {})
  }
  onReachability?.(true)

  if (response.status === 204) return undefined as T

  const body: unknown = await response.json().catch(() => ({}))

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/')) onUnauthorized?.()
    throw new ApiError(response.status, body as Partial<ApiErrorBody>)
  }
  return body as T
}

export const http = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) => request<T>('GET', path, { query, signal }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
  /** Réservé aux référentiels et aux rôles : jamais sur une opération financière (ADR-012). */
  delete: <T>(path: string) => request<T>('DELETE', path),
}

/** Dépose le cookie CSRF de Sanctum, à appeler avant la connexion. */
export async function ensureCsrfCookie(): Promise<void> {
  try {
    await fetch(CSRF_URL, { credentials: 'include' })
  } catch {
    throw new ApiError(0, {})
  }
}
