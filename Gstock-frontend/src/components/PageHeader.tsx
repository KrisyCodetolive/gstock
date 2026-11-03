import type { ReactNode } from 'react'

/** Titre d'écran : seul endroit où les majuscules sont permises (MASTER.md). */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="grid gap-1">
        <h1 className="text-[28px] leading-tight font-extrabold tracking-[-0.02em] uppercase">{title}</h1>
        {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
      </div>
      {actions}
    </header>
  )
}
