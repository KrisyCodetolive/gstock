import { LifeBuoy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSession } from '@/features/auth/hooks'
import { formatDateTime } from '@/lib/format'

/** Session ouverte par l'assistance GStock (mode support, M01) : toujours visible, avec son heure de fin. */
export function SupportBanner() {
  const { t } = useTranslation()
  const { support } = useSession()
  if (!support) return null
  return (
    <div role="status" className="flex items-center gap-3 border-b-2 border-foreground bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground lg:px-8">
      <LifeBuoy className="size-5 shrink-0" aria-hidden="true" />
      <span className="flex-1">{t('support.banner', { name: support.admin_name, time: formatDateTime(support.expires_at) })}</span>
    </div>
  )
}
