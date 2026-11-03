import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { setUnauthorizedHandler } from '@/lib/api/client'
import { queryClient } from '@/lib/query-client'
import { meQueryKey } from '@/features/auth/hooks'
import { router } from './router'

// Session expirée : on vide la session, RequireAuth renvoie vers la connexion.
setUnauthorizedHandler(() => queryClient.setQueryData(meQueryKey, null))

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
