// Textes de l'interface, uniquement en français (ADR-006).
// Un fichier par partie de l'application, réunis dans un seul espace de noms.
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import common from '@/locales/fr/common.json'
import credits from '@/locales/fr/credits.json'
import customers from '@/locales/fr/customers.json'
import products from '@/locales/fr/products.json'
import purchases from '@/locales/fr/purchases.json'
import referentials from '@/locales/fr/referentials.json'
import roles from '@/locales/fr/roles.json'
import sales from '@/locales/fr/sales.json'
import settings from '@/locales/fr/settings.json'
import shops from '@/locales/fr/shops.json'
import stock from '@/locales/fr/stock.json'
import users from '@/locales/fr/users.json'

export const defaultNS = 'common'
export const resources = { fr: { common: { ...common, ...settings, ...shops, ...roles, ...users, ...referentials, ...products, ...stock, ...customers, ...sales, ...credits, ...purchases } } } as const

void i18n.use(initReactI18next).init({
  lng: 'fr',
  fallbackLng: 'fr',
  defaultNS,
  resources,
  interpolation: { escapeValue: false },
})

export default i18n
