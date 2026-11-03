import { Compass, Lock, Hammer } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { ErrorState, MessageBlock } from '@/components/states'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/PageHeader'
import type { NavItem } from '../navigation'

function BackHome() {
  const { t } = useTranslation()
  return (
    <Button asChild variant="outline">
      <Link to="/">{t('states.back_home')}</Link>
    </Button>
  )
}

export function ForbiddenPage() {
  const { t } = useTranslation()
  return <MessageBlock icon={Lock} title={t('states.forbidden_title')} text={t('states.forbidden_text')} action={<BackHome />} />
}

export function NotFoundPage() {
  const { t } = useTranslation()
  return <MessageBlock icon={Compass} title={t('states.not_found_title')} text={t('states.not_found_text')} action={<BackHome />} />
}

/** Rubrique prévue dans une phase ultérieure (§11.4). */
export function ComingSoonPage({ item }: { item: NavItem }) {
  const { t } = useTranslation()
  return (
    <div className="grid gap-6">
      <PageHeader title={t(item.label)} />
      <MessageBlock
        icon={Hammer}
        title={t('coming.title')}
        text={t('coming.text', { phase: item.phase })}
        action={<BackHome />}
      />
    </div>
  )
}

export function RouteErrorPage() {
  const error = useRouteError()
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />
  return (
    <div className="grid min-h-dvh place-items-center">
      <ErrorState error={error} onRetry={() => window.location.reload()} />
    </div>
  )
}
