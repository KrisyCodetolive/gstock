import { useSearchParams } from 'react-router'
import type { ListParams } from '@/types/api'

/**
 * Recherche, page et filtres d'une liste, gardés dans l'adresse :
 * on peut partager ou recharger une liste filtrée (deep linking).
 */
export function useListParams(filterNames: readonly string[] = []) {
  const [searchParams, setSearchParams] = useSearchParams()

  const page = Math.max(1, Number(searchParams.get('page') ?? 1))
  const search = searchParams.get('q') ?? ''
  const filter: Record<string, string> = {}
  for (const name of filterNames) {
    const value = searchParams.get(name)
    if (value) filter[name] = value
  }

  const update = (changes: Record<string, string | number | undefined>) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(changes)) {
          if (value === undefined || value === '' || (key === 'page' && value === 1)) next.delete(key)
          else next.set(key, String(value))
        }
        return next
      },
      { replace: true },
    )

  const params: ListParams = { page, search: search || undefined, filter }

  return {
    params,
    page,
    search,
    filter,
    setPage: (p: number) => update({ page: p }),
    setSearch: (q: string) => update({ q, page: undefined }),
    setFilter: (name: string, value: string | undefined) => update({ [name]: value, page: undefined }),
  }
}
