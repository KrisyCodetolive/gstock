import type { ReactNode } from 'react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

/** Bloc d'un formulaire long : un titre, des champs, sur une carte. */
export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 rounded-lg border-2 border-foreground bg-card p-4 sm:p-5">
      <div className="grid gap-1">
        <h2 className="text-lg font-bold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}

/**
 * Boutons d'un formulaire en page : collés en bas de l'écran sur mobile
 * (au-dessus de la barre de navigation), en fin de formulaire sur desktop.
 */
export function FormActions({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 -mx-4 grid grid-cols-[auto_1fr] gap-3 border-t-2 border-foreground bg-background px-4 py-3 sm:flex sm:justify-end lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0">
      {children}
    </div>
  )
}

/** Option activable : libellé et explication à gauche, interrupteur à droite. */
export function SwitchField({
  id,
  label,
  hint,
  checked,
  onCheckedChange,
  disabled,
  className,
}: {
  id: string
  label: string
  hint?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="grid gap-1">
        <label htmlFor={id} className="font-semibold">
          {label}
        </label>
        {hint && (
          <p id={`${id}-hint`} className="text-sm text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="mt-0.5"
      />
    </div>
  )
}
