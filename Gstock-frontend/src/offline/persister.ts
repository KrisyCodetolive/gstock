// Cache des données sur l'appareil (ADR-005) : les réponses de l'API déjà reçues
// (session, caisse, produits, clients, soldes…) sont gardées dans IndexedDB pour
// s'afficher sans réseau, même après un rechargement.
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import type { Query } from '@tanstack/react-query'
import { idbStorage } from './storage'

export const persister = createAsyncStoragePersister({ storage: idbStorage, key: 'gstock.query.cache', throttleTime: 1000 })

/** Une semaine : au-delà, les données sont trop anciennes pour être utiles. */
export const CACHE_MAX_AGE = 7 * 24 * 3_600_000

/** Ni les calculs de panier ni les erreurs ne sont gardés. */
export const shouldPersist = (query: Query) => query.state.status === 'success' && query.queryKey[2] !== 'quote' && query.queryKey[0] !== 'slug-check'
