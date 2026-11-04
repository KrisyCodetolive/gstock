import { FileX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { Logo } from '@/components/Logo'
import { LoadingState, MessageBlock } from '@/components/states'
import { ApiError } from '@/lib/api/client'
import { ReceiptTicket } from '../components/ReceiptTicket'
import { usePublicReceipt } from '../hooks'

/** Reçu ouvert par le client depuis le lien WhatsApp : sans connexion, lien signé et expirant. */
export function PublicReceiptPage() {
  const { t } = useTranslation()
  const { token = '' } = useParams()
  const receipt = usePublicReceipt(token)

  return (
    <div className="grid min-h-dvh content-start justify-items-center gap-6 px-4 py-8">
      <Logo />
      {receipt.isPending ? (
        <LoadingState rows={3} />
      ) : receipt.isError ? (
        <MessageBlock
          icon={FileX}
          tone="danger"
          title={t('sales.receipt.expired')}
          text={receipt.error instanceof ApiError ? receipt.error.message : undefined}
        />
      ) : (
        <>
          <h1 className="text-xl font-bold">{t('sales.receipt.public_title')}</h1>
          <div className="rounded-lg border-2 border-foreground bg-muted p-4">
            <ReceiptTicket receipt={receipt.data} width={80} />
          </div>
        </>
      )}
    </div>
  )
}
