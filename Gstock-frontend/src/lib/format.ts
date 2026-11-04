// Formatage des montants et des dates. Les montants viennent de l'API
// (chaînes décimales) : on les affiche, on ne les recalcule jamais.
import type { Money } from '@/types/api'

const moneyFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

/** "10350.00" → "10 350" (espace insécable fine). Sans l'unité FCFA. */
export function formatAmount(value: Money | number): string {
  return moneyFormatter.format(typeof value === 'number' ? value : Number(value))
}

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Africa/Abidjan',
})

/** "2026-10-28T10:00:00Z" → "28 oct." */
export function formatShortDate(iso: string): string {
  return dateFormatter.format(new Date(iso))
}

/** Initiales pour les avatars : "Aminata Koné" → "AK". */
export function initials(firstname: string, lastname: string): string {
  return `${firstname.charAt(0)}${lastname.charAt(0)}`.toUpperCase()
}

const quantityFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 })

/** "12.000" → "12", "2.500" → "2,5". Les quantités sont en unité de base (§7.2). */
export function formatQuantity(value: string | number): string {
  return quantityFormatter.format(typeof value === 'number' ? value : Number(value))
}

const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Africa/Abidjan',
})

/** "2026-10-28T10:05:00Z" → "28 oct., 10:05" */
export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso))
}

const longDateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Africa/Abidjan',
})

/** "2026-11-18T08:00:00Z" → "18 novembre 2026" */
export function formatLongDate(iso: string): string {
  return longDateFormatter.format(new Date(iso))
}
