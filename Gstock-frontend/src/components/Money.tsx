import { formatAmount } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Money as MoneyValue } from '@/types/api'

const sizes = {
  sm: 'text-base',
  md: 'text-[22px]',
  lg: 'text-[32px]',
} as const

/** Montant en FCFA : chiffres alignés, unité plus petite et plus pâle. */
export function Money({
  value,
  size = 'sm',
  className,
}: {
  value: MoneyValue | number
  size?: keyof typeof sizes
  className?: string
}) {
  return (
    <span className={cn('tabular leading-tight font-bold', sizes[size], className)}>
      {formatAmount(value)}
      <span className="ml-1 text-[0.5em] font-semibold opacity-70">FCFA</span>
    </span>
  )
}
