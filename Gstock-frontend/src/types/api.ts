// Conventions communes de l'API (cahier §9).

/** Montant décimal envoyé sous forme de chaîne, ex. "15000.00". */
export type Money = string

/** Date ISO 8601. */
export type IsoDate = string

export type Id = number

/** Réponse d'une ressource unique. */
export interface Resource<T> {
  data: T
}

/** Réponse d'une liste paginée. */
export interface Paginated<T> {
  data: T[]
  meta: {
    current_page: number
    per_page: number
    total: number
    last_page: number
  }
}

/** Paramètres acceptés par toutes les listes. */
export interface ListParams {
  page?: number
  per_page?: number
  search?: string
  /** Champ de tri, préfixé par « - » pour un tri décroissant. */
  sort?: string
  filter?: Record<string, string | number | boolean | undefined>
}

/** Corps d'une erreur renvoyée par l'API (422 et autres). */
export interface ApiErrorBody {
  message: string
  errors?: Record<string, string[]>
}
