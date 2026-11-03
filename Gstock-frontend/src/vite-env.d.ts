/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL de base de l'API, par défaut /api/v1. */
  readonly VITE_API_URL?: string
  /** URL du cookie CSRF Sanctum, par défaut /sanctum/csrf-cookie. */
  readonly VITE_CSRF_URL?: string
  /** "true" active les données simulées (MSW). */
  readonly VITE_USE_MOCKS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
