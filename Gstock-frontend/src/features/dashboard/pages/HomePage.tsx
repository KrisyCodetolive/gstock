import { useTranslation } from 'react-i18next'
import { ActionCard } from '@/components/ActionCard'
import { PageHeader } from '@/components/PageHeader'
import { useAllowedNav } from '@/app/layout/useAllowedNav'
import { useSession } from '@/features/auth/hooks'
import { useCurrentShop } from '@/features/shops/hooks'

/** Accueil du socle : actions rapides selon les permissions. Les indicateurs arrivent en F7. */
export function HomePage() {
  const { t } = useTranslation()
  const { user } = useSession()
  const { shop } = useCurrentShop()
  const actions = useAllowedNav().filter((item) => item.description)

  return (
    <div className="grid gap-6">
      <PageHeader title={t('home.hello', { name: user.firstname })} subtitle={shop ? `${shop.name} · ${t('home.intro')}` : t('home.intro')} />
      <section className="grid gap-3" aria-labelledby="quick-actions">
        <h2 id="quick-actions" className="text-xl font-bold">
          {t('home.quick_actions')}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {actions.map((item) => (
            <li key={item.id}>
              <ActionCard
                to={item.path}
                icon={item.icon}
                title={t(item.label)}
                description={item.description && t(item.description)}
                tint={item.tint}
                className="h-full"
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
