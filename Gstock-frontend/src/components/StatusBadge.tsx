import { cva, type VariantProps } from 'class-variance-authority'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-sm border-2 border-current px-2.5 py-0.5 text-xs font-extrabold whitespace-nowrap',
  {
    variants: {
      tone: {
        paid: 'bg-tint-mint text-paid-ink',
        warn: 'bg-warn-bg text-warn',
        danger: 'bg-destructive-bg text-destructive',
        neutral: 'bg-muted text-foreground',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

/** Badge d'état : la couleur n'est jamais seule, le libellé dit l'état. */
export function StatusBadge({
  tone,
  children,
  className,
}: VariantProps<typeof badgeVariants> & { children: ReactNode; className?: string }) {
  return <span className={cn(badgeVariants({ tone }), className)}>{children}</span>
}
