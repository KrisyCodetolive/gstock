import { Minus, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * Quantité : gros boutons − et + pour le pouce, clavier numérique pour la saisie
 * (§3.4). La valeur reste une chaîne (virgule acceptée).
 */
export function QuantityInput({
  id,
  value,
  onChange,
  min = 0,
  invalid,
  describedBy,
  label,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  min?: number
  invalid?: boolean
  describedBy?: string
  label: string
}) {
  const { t } = useTranslation()
  const n = Number(value.replace(',', '.')) || 0
  const step = (delta: number) => onChange(String(Math.max(min, Math.round((n + delta) * 1000) / 1000)))

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="icon" onClick={() => step(-1)} disabled={n <= min} aria-label={t('stock.form.decrease')}>
        <Minus strokeWidth={2.6} aria-hidden="true" />
      </Button>
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        className={cn('tabular w-24 text-center text-lg font-bold')}
      />
      <Button type="button" variant="outline" size="icon" onClick={() => step(1)} aria-label={t('stock.form.increase')}>
        <Plus strokeWidth={2.6} aria-hidden="true" />
      </Button>
    </div>
  )
}
