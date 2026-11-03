import i18n from '@/lib/i18n'
import type { Role } from '@/types/auth'

/** Nom affiché d'un rôle : « Owner » reste dans le code, l'écran dit « Propriétaire ». */
export function roleLabel(role: Pick<Role, 'name' | 'is_owner'>): string {
  return role.is_owner ? i18n.t('roles_display.owner') : role.name
}
