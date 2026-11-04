import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api/client'

/** Erreurs pour lesquelles réessayer ne changera rien. */
const NO_RETRY = new Set([401, 403, 404, 409, 422])

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Gardées une semaine pour le cache de l'appareil (ADR-005).
      gcTime: 7 * 24 * 3_600_000,
      retry: (failureCount, error) =>
        !(error instanceof ApiError && NO_RETRY.has(error.status)) && failureCount < 2,
    },
    mutations: {
      retry: false,
      // Sans réseau, une action échoue tout de suite avec un message clair (au lieu d'attendre),
      // sauf les opérations faisables hors ligne, qui sont gardées sur l'appareil (src/offline).
      networkMode: 'always',
    },
  },
})
