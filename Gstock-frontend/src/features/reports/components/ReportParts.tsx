import type { BarChart3 } from 'lucide-react'
import type { ReactNode } from 'react'
import { FieldError } from '@/components/FormField'
import { ErrorState } from '@/components/states'
import { ApiError } from '@/lib/api/client'
import { apiErrorMessage } from '@/lib/form-errors'
import { cn } from '@/lib/utils'

// Pièces communes aux onglets des rapports (M15).

export function Segmented<T extends string | number | boolean>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="inline-flex rounded-md border-2 border-foreground bg-card p-1" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn('min-h-9 rounded-sm px-3 text-sm font-bold', value === o.value ? 'bg-foreground text-background' : 'hover:bg-muted')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Chiffre non cliquable : contour, sans ombre décalée (MASTER.md). */
export function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid content-start gap-1 rounded-lg border-2 border-foreground bg-card p-4">
      <span className="text-sm font-semibold text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

export function Section({ title, hint, icon: Icon, children }: { title: string; hint?: string; icon: typeof BarChart3; children: ReactNode }) {
  return (
    <section className="grid gap-4 rounded-lg border-2 border-foreground bg-card p-4 sm:p-5">
      <div className="grid gap-1">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Icon className="size-5" aria-hidden="true" />
          {title}
        </h2>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

/** Une erreur de période (422) s'affiche sous les filtres ; les autres en état d'erreur. */
export function ReportError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  if (error instanceof ApiError && error.status === 422) return <FieldError>{apiErrorMessage(error)}</FieldError>
  return <ErrorState error={error} onRetry={onRetry} />
}
