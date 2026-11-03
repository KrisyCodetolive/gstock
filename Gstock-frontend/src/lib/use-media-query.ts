import { useSyncExternalStore } from 'react'

/** Vrai si la requête média correspond, mis à jour au redimensionnement. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** Points de rupture du design system (MASTER.md, Mise en page). */
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)')
