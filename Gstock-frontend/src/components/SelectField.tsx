import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form'
import { FieldError } from '@/components/FormField'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

/** Valeur interne du choix « aucun » (Radix interdit la valeur vide). */
const NONE = '__none__'

/**
 * Liste déroulante reliée à React Hook Form, avec libellé, aide et erreur.
 * `noneLabel` ajoute un choix vide (valeur '' dans le formulaire).
 */
export function SelectField<T extends FieldValues>({
  control,
  name,
  label,
  options,
  placeholder,
  noneLabel,
  hint,
  error,
  className,
}: {
  control: Control<T>
  name: Path<T>
  label: string
  options: { value: string; label: string }[]
  placeholder?: string
  noneLabel?: string
  hint?: string
  error?: string
  className?: string
}) {
  const id = String(name)
  return (
    <div className={cn('grid gap-2', className)}>
      <label htmlFor={id} className="text-sm leading-none font-semibold">
        {label}
      </label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select value={field.value === '' && noneLabel ? NONE : field.value} onValueChange={(v) => field.onChange(v === NONE ? '' : v)}>
            <SelectTrigger
              id={id}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
            >
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {noneLabel && <SelectItem value={NONE}>{noneLabel}</SelectItem>}
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  )
}
