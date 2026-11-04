import { Copy, MessageCircle, Printer } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { toast } from 'sonner'
import { BackLink } from '@/components/BackLink'
import { PageHeader } from '@/components/PageHeader'
import { ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useCurrentShop } from '@/features/shops/hooks'
import { apiErrorMessage } from '@/lib/form-errors'
import { cn } from '@/lib/utils'
import { ReceiptTicket } from '../components/ReceiptTicket'
import { useReceipt, useShareLink } from '../hooks'

/** Lien WhatsApp : vers le client s'il a un numéro ivoirien, sinon choix du contact. */
function whatsappUrl(message: string, phone: string | null) {
  const digits = phone?.replace(/\D/g, '')
  const to = digits ? (digits.length === 10 ? `225${digits}` : digits) : ''
  return `https://wa.me/${to}?text=${encodeURIComponent(message)}`
}

/** Reçu d'une vente : impression 58/80 mm ou partage WhatsApp (ADR-013). */
export function ReceiptPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const { shop } = useCurrentShop()
  const receipt = useReceipt(shop?.id, Number(id))
  const share = useShareLink(shop?.id, Number(id))
  const [width, setWidth] = useState<58 | 80>(58)
  const [link, setLink] = useState<string | null>(null)

  // Le commerçant vérifie et envoie lui-même : aucun envoi automatique (ADR-013).
  const openWhatsapp = () =>
    share.mutate(undefined, {
      onSuccess: (l) => {
        setLink(l.url)
        window.open(whatsappUrl(l.message, receipt.data?.sale.customer?.phone ?? null), '_blank', 'noopener')
      },
      onError: (e) => toast.error(apiErrorMessage(e)),
    })

  return (
    <div className="grid gap-6">
      <div className="no-print grid gap-6">
        <BackLink to={`/ventes/${id}`} label={receipt.data ? t('sales.detail.title', { reference: receipt.data.sale.reference }) : t('sales.detail.back')} />
        <PageHeader title={receipt.data ? t('sales.receipt.title', { reference: receipt.data.sale.reference }) : t('states.loading')} />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="action" onClick={openWhatsapp} disabled={!receipt.data || share.isPending}>
            <MessageCircle aria-hidden="true" />
            {share.isPending ? t('sales.receipt.sharing') : t('sales.receipt.share')}
          </Button>
          <Button variant="outline" onClick={() => window.print()} disabled={!receipt.data}>
            <Printer aria-hidden="true" />
            {t('sales.receipt.print')}
          </Button>
          <div className="inline-flex rounded-md border-2 border-foreground bg-card p-1" role="group" aria-label={t('sales.receipt.width')}>
            {([58, 80] as const).map((w) => (
              <button
                key={w}
                type="button"
                aria-pressed={width === w}
                onClick={() => setWidth(w)}
                className={cn('min-h-10 rounded-sm px-3 text-sm font-bold', width === w ? 'bg-foreground text-background' : 'hover:bg-muted')}
              >
                {w} mm
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{t('sales.receipt.share_hint')}</p>
        {link && (
          <div className="flex flex-wrap items-center gap-2 rounded-sm bg-muted p-3 text-sm">
            <span className="min-w-0 flex-1 truncate font-mono">{link}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                navigator.clipboard.writeText(link).then(
                  () => toast.success(t('sales.receipt.copied')),
                  () => undefined,
                )
              }
            >
              <Copy aria-hidden="true" />
              {t('sales.receipt.copy')}
            </Button>
          </div>
        )}
      </div>

      {receipt.isPending ? (
        <LoadingState rows={4} />
      ) : receipt.isError ? (
        <ErrorState error={receipt.error} onRetry={() => void receipt.refetch()} />
      ) : (
        <div className="print-area overflow-x-auto rounded-lg border-2 border-foreground bg-muted p-4">
          <ReceiptTicket receipt={receipt.data} width={width} />
        </div>
      )}
    </div>
  )
}
