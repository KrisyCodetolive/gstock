import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { ApiError } from '@/lib/api/client'
import i18n from '@/lib/i18n'

/**
 * Reporte les erreurs 422 du serveur sous les champs du formulaire.
 * Renvoie le message général à afficher s'il reste une erreur sans champ connu.
 */
export function applyApiErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): string | null {
  if (!(error instanceof ApiError)) return i18n.t('common.generic_error')
  let placed = false
  for (const field of fields) {
    const message = error.fieldError(field)
    if (message) {
      setError(field, { message })
      placed = true
    }
  }
  return placed ? null : error.message
}

/** Message à montrer dans une notification : la première erreur de champ, sinon le message général. */
export function apiErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return i18n.t('common.generic_error')
  return Object.values(error.errors)[0]?.[0] ?? error.message
}
