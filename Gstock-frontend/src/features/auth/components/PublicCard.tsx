import type { ReactNode } from 'react'
import { Logo } from '@/components/Logo'

/** Mise en page des écrans sans connexion : logo, puis une carte avec titre et texte. */
export function PublicCard({ title, text, children, footer }: { title: string; text?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="min-h-dvh px-4 py-8 lg:grid lg:place-items-center">
      <div className="mx-auto grid w-full max-w-md gap-6">
        <Logo className="justify-self-center" />
        <div className="pressable-lg grid gap-5 rounded-lg bg-card p-5">
          <div className="grid gap-1">
            <h1 className="text-[28px] leading-tight font-extrabold tracking-[-0.02em] uppercase">{title}</h1>
            {text && <p className="text-muted-foreground">{text}</p>}
          </div>
          {children}
        </div>
        {footer}
      </div>
    </div>
  )
}
