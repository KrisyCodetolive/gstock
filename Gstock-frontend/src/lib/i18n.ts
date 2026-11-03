// Textes de l'interface, uniquement en français (ADR-006).
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import common from '@/locales/fr/common.json'

export const defaultNS = 'common'
export const resources = { fr: { common } } as const

void i18n.use(initReactI18next).init({
  lng: 'fr',
  fallbackLng: 'fr',
  defaultNS,
  resources,
  interpolation: { escapeValue: false },
})

export default i18n
