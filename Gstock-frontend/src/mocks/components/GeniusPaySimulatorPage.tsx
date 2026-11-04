// Page de paiement GeniusPay simulée : sur le vrai service, c'est une page externe.
// L'abonnement n'est prolongé qu'au webhook, envoyé ici quelques secondes après le choix.
import { CreditCard, Smartphone } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { Logo } from '@/components/Logo'
import { Money } from '@/components/Money'
import { MessageBlock } from '@/components/states'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { geniusPayPlatformWebhook, platform } from '../platform'

const CHANNELS = ['Wave', 'Orange Money', 'MTN Money', 'Moov Money', 'Carte bancaire']
const RETURN_URL = '/parametres/abonnement'
const WEBHOOK_DELAY = 2500

export function GeniusPaySimulatorPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { invoiceId } = useParams()
  const invoice = platform.invoices.find((i) => i.id === Number(invoiceId) && i.status === 'pending')
  const [channel, setChannel] = useState(CHANNELS[0]!)

  const finish = (outcome: 'success' | 'failed') => {
    const id = invoice!.id
    setTimeout(() => geniusPayPlatformWebhook(id, outcome, channel), WEBHOOK_DELAY)
    void navigate(RETURN_URL, { replace: true })
  }

  return (
    <div className="min-h-dvh px-4 py-8 lg:grid lg:place-items-center">
      <div className="mx-auto grid w-full max-w-md gap-6">
        <Logo className="justify-self-center" />
        {!invoice ? (
          <MessageBlock icon={CreditCard} tone="danger" title={t('simulation.title')} text={t('simulation.unknown')} action={<Button onClick={() => navigate(RETURN_URL)}>{t('subscription.title')}</Button>} />
        ) : (
          <div className="pressable-lg grid gap-5 rounded-lg bg-card p-5">
            <div className="grid gap-1">
              <h1 className="text-xl font-extrabold">{t('simulation.title')}</h1>
              <p className="text-sm text-muted-foreground">{t('simulation.text')}</p>
            </div>
            <p className="flex items-baseline justify-between gap-2 font-semibold">
              {t('simulation.invoice', { reference: invoice.reference })}
              <Money value={invoice.amount} size="md" />
            </p>
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-semibold">{t('simulation.channel')}</legend>
              {CHANNELS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={channel === c}
                  onClick={() => setChannel(c)}
                  className={cn('pressable flex min-h-12 items-center gap-3 rounded-md bg-card px-3 text-left font-bold', channel === c && 'bg-tint-yellow')}
                >
                  {c === 'Carte bancaire' ? <CreditCard className="size-5" aria-hidden="true" /> : <Smartphone className="size-5" aria-hidden="true" />}
                  {c}
                </button>
              ))}
            </fieldset>
            <div className="grid gap-2">
              <Button variant="action" size="lg" onClick={() => finish('success')}>
                {t('simulation.pay')}
              </Button>
              <Button variant="outline" onClick={() => finish('failed')}>
                {t('simulation.fail')}
              </Button>
              <Button variant="ghost" onClick={() => finish('failed')}>
                {t('simulation.cancel')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
