import { CircleAlert } from 'lucide-react'
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import i18n from '@/lib/i18n'
import { cn } from '@/lib/utils'

/**
 * Champ de formulaire : libellé visible, aide, erreur sous le champ (MASTER.md).
 * Relie automatiquement le libellé, l'aide et l'erreur au contrôle enfant.
 */
export function FormField({
  id,
  label,
  hint,
  error,
  optional,
  className,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  optional?: boolean
  className?: string
  children: ReactElement<Record<string, unknown>>
}) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
      })
    : children

  return (
    <div className={cn('grid gap-2', className)}>
      <Label htmlFor={id}>
        {label}
        {optional && <span className="font-normal text-muted-foreground">{i18n.t('common.optional')}</span>}
      </Label>
      {control}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  )
}

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="text-sm font-semibold text-destructive">
      {children}
    </p>
  )
}

/** Erreur générale d'un formulaire (message du serveur sans champ précis). */
export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex gap-2 rounded-sm border-2 border-destructive bg-destructive-bg p-3 text-sm font-semibold text-destructive">
      <CircleAlert className="size-5 shrink-0" aria-hidden="true" />
      {children}
    </p>
  )
}
