// Stockage de l'appareil dans IndexedDB (ADR-005) : cache des données et file des
// opérations hors ligne. Une seule base « gstock », un magasin clé → valeur.
import { createStore, del, get, set } from 'idb-keyval'
import type { StateStorage } from 'zustand/middleware'

const store = createStore('gstock', 'kv')

export const idbStorage = {
  getItem: (key: string) => get<string>(key, store).then((v) => v ?? null),
  setItem: (key: string, value: string) => set(key, value, store),
  removeItem: (key: string) => del(key, store),
} satisfies StateStorage
