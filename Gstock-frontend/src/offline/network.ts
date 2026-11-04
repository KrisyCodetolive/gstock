// État du réseau : l'appareil est-il connecté et le serveur répond-il ? (ADR-005)
import { create } from 'zustand'
import { setReachabilityHandler } from '@/lib/api/client'

interface NetworkState {
  /** Le navigateur a du réseau. */
  browserOnline: boolean
  /** La dernière requête a reçu une réponse du serveur. */
  reachable: boolean
}

export const useNetworkStore = create<NetworkState>(() => ({
  browserOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
  reachable: true,
}))

/** En ligne = réseau présent et serveur joignable. */
export const isOnline = () => {
  const s = useNetworkStore.getState()
  return s.browserOnline && s.reachable
}

export function useOnline() {
  return useNetworkStore((s) => s.browserOnline && s.reachable)
}

let started = false

/** À appeler une fois au démarrage. */
export function startNetworkWatch() {
  if (started) return
  started = true
  window.addEventListener('online', () => useNetworkStore.setState({ browserOnline: true, reachable: true }))
  window.addEventListener('offline', () => useNetworkStore.setState({ browserOnline: false }))
  setReachabilityHandler((reachable) => {
    if (useNetworkStore.getState().reachable !== reachable) useNetworkStore.setState({ reachable })
  })
}
