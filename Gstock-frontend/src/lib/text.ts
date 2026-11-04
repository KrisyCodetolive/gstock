/** Comparaison sans accents ni majuscules, pour les recherches locales. */
export function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}
