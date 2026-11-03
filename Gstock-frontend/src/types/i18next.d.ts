// Clés de traduction typées : une clé inexistante est une erreur de compilation.
import 'i18next'
import type { defaultNS, resources } from '@/lib/i18n'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS
    resources: (typeof resources)['fr']
  }
}
