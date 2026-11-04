import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, CloudOff, RefreshCw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Money } from '@/components/Money'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/states'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/hooks'
import { formatDateTime } from '@/lib/format'
import { useOnline } from '@/offline/network'
import { useOfflineQueue, type OfflineOperation, type OperationStatus } from '@/offline/queue'
import { syncNow } from '@/offline/sync'

const TONE: Record<OperationStatus, 'warn' | 'paid' | 'danger' | 'neutral'> = {
  pending: 'neutral',
  syncing: 'neutral',
  synced: 'paid',
  to_review: 'warn',
  rejected: 'danger',
}

/** Où voir l'opération une fois enregistrée par le serveur. */
function linkOf(op: OfflineOperation): string | null {
  const id = op.result?.resource?.id
  if (!id) return null
  if (op.type === 'sale') return `/ventes/${id}`
  if (op.type === 'repayment') return `/credits/paiements/${id}`
  return '/depenses'
}

/** Synchronisation (M08) : la file des opérations faites sans réseau sur cet appareil. */
export function SyncPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const me = useSession()
  const online = useOnline()
  const all = useOfflineQueue((s) => s.operations)
  const clearSynced = useOfflineQueue((s) => s.clearSynced)
  const [sending, setSending] = useState(false)

  const mine = all.filter((o) => o.user_id === me.user.id).toReversed()
  const pending = mine.filter((o) => o.status === 'pending' || o.status === 'syncing')
  const review = mine.filter((o) => o.status === 'to_review' || o.status === 'rejected')
  const synced = mine.filter((o) => o.status === 'synced')

  const send = () => {
    setSending(true)
    void syncNow(queryClient, me.user.id).finally(() => setSending(false))
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title={t('offline.page.title')}
        subtitle={t('offline.page.subtitle')}
        actions={
          pending.length > 0 && (
            <Button variant="action" onClick={send} disabled={!online || sending}>
              <RefreshCw className={sending ? 'animate-spin' : undefined} aria-hidden="true" />
              {sending ? t('offline.page.sending') : t('offline.page.send_now')}
            </Button>
          )
        }
      />
      {!online && pending.length > 0 && (
        <p className="flex gap-2 rounded-md border-2 border-warn bg-warn-bg p-3 text-sm font-semibold text-warn" role="status">
          <CloudOff className="size-5 shrink-0" aria-hidden="true" />
          {t('offline.page.offline_hint')}
        </p>
      )}

      {mine.length === 0 ? (
        <EmptyState icon={CheckCircle2} title={t('offline.page.empty_title')} text={t('offline.page.empty_text')} />
      ) : (
        <>
          <Group title={t('offline.page.review')} operations={review} />
          <Group title={t('offline.page.pending')} operations={pending} />
          <Group title={t('offline.page.synced')} operations={synced} />
          {synced.length > 0 && (
            <Button variant="ghost" className="justify-self-start" onClick={clearSynced}>
              <Trash2 aria-hidden="true" />
              {t('offline.page.clear_synced')}
            </Button>
          )}
        </>
      )}
    </div>
  )
}

function Group({ title, operations }: { title: string; operations: OfflineOperation[] }) {
  if (operations.length === 0) return null
  return (
    <section className="grid gap-3" aria-label={title}>
      <h2 className="text-xl font-bold">
        {title} <span className="tabular text-muted-foreground">({operations.length})</span>
      </h2>
      <ul className="grid gap-3">
        {operations.map((op) => (
          <li key={op.offline_uuid}>
            <OperationCard op={op} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function OperationCard({ op }: { op: OfflineOperation }) {
  const { t } = useTranslation()
  const remove = useOfflineQueue((s) => s.remove)
  const setStatus = useOfflineQueue((s) => s.setStatus)
  const [confirming, setConfirming] = useState(false)
  const link = linkOf(op)
  const reasons = op.result?.reasons ?? []

  return (
    <div className="pressable grid gap-2 rounded-lg bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="grid min-w-0 gap-0.5">
          <span className="font-bold">
            {t(`offline.types.${op.type}`)} {op.result?.resource?.reference ?? op.provisional_reference}
            {op.label && ` · ${op.label}`}
          </span>
          <span className="text-sm text-muted-foreground">
            {[formatDateTime(op.occurred_at), op.shop_name, op.result?.resource && op.result.resource.reference !== op.provisional_reference && op.provisional_reference].filter(Boolean).join(' · ')}
          </span>
        </div>
        <div className="grid justify-items-end gap-1">
          <Money value={op.amount} />
          <StatusBadge tone={TONE[op.status]}>{t(`offline.statuses.${op.status}`)}</StatusBadge>
        </div>
      </div>

      {op.status === 'to_review' && <p className="text-sm font-semibold text-warn">{t('offline.page.review_hint')}</p>}
      {op.status === 'rejected' && <p className="text-sm font-semibold text-destructive">{t('offline.page.rejected_hint')}</p>}
      {reasons.length > 0 && (
        <ul className="grid list-disc gap-1 pl-5 text-sm">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      {op.last_error && op.status !== 'synced' && reasons.length === 0 && <p className="text-sm text-destructive">{op.last_error}</p>}
      {op.status === 'pending' && op.attempts > 0 && <p className="text-xs text-muted-foreground">{t('offline.page.attempts', { count: op.attempts })}</p>}

      {(link || op.status === 'rejected' || op.status === 'to_review') && (
        <div className="flex flex-wrap gap-2">
          {link && (
            <Button asChild variant="outline" size="sm">
              <Link to={link}>{t('offline.page.open')}</Link>
            </Button>
          )}
          {op.status === 'to_review' && (
            <Button variant="ghost" size="sm" onClick={() => setStatus([op.offline_uuid], 'synced')}>
              <CheckCircle2 aria-hidden="true" />
              {t('offline.page.checked')}
            </Button>
          )}
          {op.status === 'rejected' && (
            <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
              <Trash2 aria-hidden="true" />
              {t('offline.page.remove')}
            </Button>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('offline.page.remove_title')}
        description={t('offline.page.remove_text')}
        confirmLabel={t('offline.page.remove')}
        destructive
        onConfirm={() => {
          remove(op.offline_uuid)
          toast.success(t('offline.page.removed'))
        }}
      />
    </div>
  )
}
