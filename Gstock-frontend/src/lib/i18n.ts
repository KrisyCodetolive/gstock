// Textes de l'interface, uniquement en français (ADR-006).
// Un fichier par partie de l'application, réunis dans un seul espace de noms.
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import common from '@/locales/fr/common.json'
import settings from '@/locales/fr/settings.json'

export const defaultNS = 'common'
export const resources = { fr: { common: { ...common, ...settings } } } as const

void i18n.use(initReactI18next).init({
  lng: 'fr',
  fallbackLng: 'fr',
  defaultNS,
  resources,
  interpolation: { escapeValue: false },
})

export default i18n
