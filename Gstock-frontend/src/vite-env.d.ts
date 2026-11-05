/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL de base de l'API, par défaut /api/v1. */
  readonly VITE_API_URL?: string
  /** URL du cookie CSRF Sanctum, par défaut /sanctum/csrf-cookie. */
  readonly VITE_CSRF_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
