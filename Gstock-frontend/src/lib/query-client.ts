import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api/client'

/** Erreurs pour lesquelles réessayer ne changera rien. */
const NO_RETRY = new Set([401, 403, 404, 409, 422])

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) =>
        !(error instanceof ApiError && NO_RETRY.has(error.status)) && failureCount < 2,
    },
    mutations: {
      retry: false,
    },
  },
})
