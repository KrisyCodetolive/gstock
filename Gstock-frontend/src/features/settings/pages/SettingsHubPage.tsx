import { useTranslation } from 'react-i18next'
import { ActionCard } from '@/components/ActionCard'
import { PageHeader } from '@/components/PageHeader'
import { useCan } from '@/features/auth/hooks'
import { useSettings } from '../hooks'
import { SETTINGS_SECTIONS, type SettingsSection } from '../sections'

const GROUPS: SettingsSection['group'][] = ['business', 'team', 'lists']

/** Accueil des paramètres : seules les rubriques autorisées apparaissent. */
export function SettingsHubPage() {
  const { t } = useTranslation()
  const can = useCan()
  const settings = useSettings(can('settings.manage'))
  const advanced = settings.data?.advanced_mode ?? false

  const visible = SETTINGS_SECTIONS.filter((s) => can(s.permissions) && (!s.advanced || advanced))

  return (
    <div className="grid gap-8">
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />
      {GROUPS.map((group) => {
        const sections = visible.filter((s) => s.group === group)
        if (sections.length === 0) return null
        return (
          <section key={group} className="grid gap-3" aria-labelledby={`settings-${group}`}>
            <h2 id={`settings-${group}`} className="text-xl font-bold">
              {t(`settings.groups.${group}`)}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {sections.map((s) => (
                <li key={s.id}>
                  <ActionCard to={s.path} icon={s.icon} title={t(s.label)} description={t(s.description)} tint={s.tint} className="h-full" />
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
