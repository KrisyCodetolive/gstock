import { Ban } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { BackLink } from '@/components/BackLink'
import { FormAlert } from '@/components/FormField'
import { FormSection } from '@/components/FormLayout'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { ErrorState, LoadingState } from '@/components/states'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useCan } from '@/features/auth/hooks'
import { useCurrentShop } from '@/features/shops/hooks'
import { apiErrorMessage } from '@/lib/form-errors'
import { formatDateTime, formatQuantity } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Adjustment } from '@/types/stock'
import { useAdjustment, useCancelAdjustment } from '../hooks'

/** Fiche d'un mouvement manuel MS-N, avec son annulation motivée (ADR-012). */
export function AdjustmentDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const { shop } = useCurrentShop()
  const adjustment = useAdjustment(shop?.id, Number(id))

  return (
    <div className="grid gap-6">
      <BackLink to="/stock/mouvements" label={t('stock.movements.title')} />
      {adjustment.isPending ? (
        <LoadingState rows={3} />
      ) : adjustment.isError ? (
        <ErrorState error={adjustment.error} onRetry={() => void adjustment.refetch()} />
      ) : (
        <AdjustmentDetail adjustment={adjustment.data} />
      )}
    </div>
  )
}

function AdjustmentDetail({ adjustment: a }: { adjustment: Adjustment }) {
  const { t } = useTranslation()
  const can = useCan()
  const cancelled = a.status === 'cancelled'

  return (
    <>
      <PageHeader
        title={t('stock.adjustment.title', { reference: a.reference })}
        subtitle={t(`stock.adjustment.kinds.${a.kind}`)}
        actions={
          cancelled ? (
            <StatusBadge tone="danger">{t('stock.adjustment.status_cancelled')}</StatusBadge>
          ) : (
            <StatusBadge tone="paid">{t('stock.adjustment.status_completed')}</StatusBadge>
          )
        }
      />
      <div className="grid gap-1 text-[15px]">
        <p className="font-semibold">{t('stock.adjustment.reason', { reason: a.reason })}</p>
        <p className="text-muted-foreground">{t('stock.adjustment.by', { name: a.user?.name ?? '—', date: formatDateTime(a.occurred_at) })}</p>
        {cancelled && a.cancelled_at && (
          <p className="font-semibold text-destructive">{t('stock.adjustment.cancelled_on', { date: formatDateTime(a.cancelled_at), reason: a.cancel_reason })}</p>
        )}
      </div>

      <FormSection title={t('stock.adjustment.items')}>
        <ul className="grid divide-y-2 divide-muted">
          {a.items.map((item) => {
            const n = Number(item.quantity)
            const signed = a.kind === 'exit' ? -n : n
            return (
              <li key={item.product.id}>
                <Link to={`/produits/${item.product.id}`} className="flex items-center justify-between gap-3 rounded-md px-2 py-3 hover:bg-muted">
                  <span className="grid">
                    <span className="font-bold">{item.product.name}</span>
                    {item.counted_quantity !== null && (
                      <span className="text-sm text-muted-foreground">
                        {t('stock.form.counted')} : {formatQuantity(item.counted_quantity)} {item.product.unit.short_name}
                      </span>
                    )}
                  </span>
                  <span className={cn('tabular text-lg font-extrabold', signed > 0 && 'text-paid-ink', signed < 0 && 'text-destructive', cancelled && 'line-through opacity-60')}>
                    {signed > 0 ? '+' : signed < 0 ? '−' : ''}
                    {formatQuantity(Math.abs(signed))} {item.product.unit.short_name}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </FormSection>

      {!cancelled && can('stock.adjust') && <CancelSection adjustment={a} />}
    </>
  )
}

function CancelSection({ adjustment }: { adjustment: Adjustment }) {
  const { t } = useTranslation()
  const { shop } = useCurrentShop()
  const cancel = useCancelAdjustment(shop?.id, adjustment.id)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const confirm = () => {
    if (!reason.trim()) {
      setError(t('stock.adjustment.cancel_reason_required'))
      return
    }
    cancel.mutate(reason.trim(), {
      onSuccess: () => {
        setOpen(false)
        toast.success(t('stock.adjustment.cancelled'))
      },
      onError: (e) => setError(apiErrorMessage(e)),
    })
  }

  return (
    <FormSection title={t('stock.adjustment.cancel')} description={t('stock.adjustment.cancel_text')}>
      <Button variant="destructive" className="justify-self-start" onClick={() => setOpen(true)}>
        <Ban aria-hidden="true" />
        {t('stock.adjustment.cancel')}
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) setError(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('stock.adjustment.cancel_title', { reference: adjustment.reference })}</AlertDialogTitle>
            <AlertDialogDescription>{t('stock.adjustment.cancel_text')}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="cancel_reason">{t('stock.adjustment.cancel_reason')}</Label>
            <Textarea id="cancel_reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={error ? true : undefined} />
            {error && <FormAlert>{error}</FormAlert>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancel.isPending}>{t('common.cancel')}</AlertDialogCancel>
            <Button variant="destructive" disabled={cancel.isPending} onClick={confirm}>
              {t('stock.adjustment.cancel')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FormSection>
  )
}
