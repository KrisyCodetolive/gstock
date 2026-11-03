import i18n from '@/lib/i18n'

export type ReferentialPrefix =
  | 'referentials.categories'
  | 'referentials.units'
  | 'referentials.payment_methods'
  | 'referentials.expense_categories'
  | 'referentials.brands'

/** Textes de l'écran commun d'un référentiel. */
export function referentialTexts(prefix: ReferentialPrefix) {
  return {
    title: i18n.t(`${prefix}.title`),
    subtitle: i18n.t(`${prefix}.subtitle`),
    add: i18n.t(`${prefix}.add`),
    edit: i18n.t(`${prefix}.edit`),
    search: i18n.t(`${prefix}.search`),
    emptyTitle: i18n.t(`${prefix}.empty_title`),
    emptyText: i18n.t(`${prefix}.empty_text`),
  }
}
