import { ChevronRight, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'

const tints = {
  peach: 'bg-tint-peach',
  yellow: 'bg-tint-yellow',
  mint: 'bg-tint-mint',
  lavender: 'bg-tint-lavender',
} as const

/**
 * Carte de navigation ou d'action rapide (§3.3).
 * Elle mène toujours quelque part : `to` est obligatoire.
 */
export function ActionCard({
  to,
  icon: Icon,
  title,
  description,
  tint = 'lavender',
  className,
}: {
  to: string
  icon: LucideIcon
  title: string
  description?: string
  tint?: keyof typeof tints
  className?: string
}) {
  return (
    <Link
      to={to}
      className={cn(
        'pressable-lg flex min-h-20 items-center gap-3 rounded-lg bg-card p-3 text-foreground hover:bg-[color-mix(in_srgb,var(--card),var(--muted)_40%)]',
        className,
      )}
    >
      <span className={cn('grid size-12 shrink-0 place-items-center rounded-sm', tints[tint])}>
        <Icon className="size-6" strokeWidth={2.2} aria-hidden="true" />
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="text-base leading-tight font-bold">{title}</span>
        {description && <span className="text-sm leading-snug text-muted-foreground">{description}</span>}
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  )
}
