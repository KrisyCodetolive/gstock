import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { RouterProvider } from 'react-router/dom'
import { Toaster } from '@/components/ui/sonner'
import { setUnauthorizedHandler } from '@/lib/api/client'
import { queryClient } from '@/lib/query-client'
import { meQueryKey } from '@/features/auth/hooks'
import { startNetworkWatch } from '@/offline/network'
import { CACHE_MAX_AGE, persister, shouldPersist } from '@/offline/persister'
import { startInstallWatch } from '@/offline/install'
import { router } from './router'

// Session expirée : on vide la session, RequireAuth renvoie vers la connexion.
setUnauthorizedHandler(() => queryClient.setQueryData(meQueryKey, null))
startNetworkWatch()
startInstallWatch()

export function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: CACHE_MAX_AGE, buster: 'v1', dehydrateOptions: { shouldDehydrateQuery: shouldPersist } }}
      // Les données de l'appareil s'affichent tout de suite, puis sont relues dès que le réseau le permet.
      onSuccess={() => void queryClient.invalidateQueries()}
    >
      <RouterProvider router={router} />
      <Toaster />
    </PersistQueryClientProvider>
  )
}
