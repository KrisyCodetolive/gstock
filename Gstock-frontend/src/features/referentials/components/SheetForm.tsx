import type { FormEventHandler, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { FormAlert } from '@/components/FormField'
import { SwitchField } from '@/components/FormLayout'
import { Button } from '@/components/ui/button'

/** Formulaire dans un panneau : champs, puis boutons collés en bas du panneau. */
export function SheetForm({
  onSubmit,
  onCancel,
  pending,
  error,
  submitLabel,
  children,
}: {
  onSubmit: FormEventHandler<HTMLFormElement>
  onCancel: () => void
  pending: boolean
  error: string | null
  submitLabel: string
  children: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <form onSubmit={onSubmit} noValidate className="grid min-h-full content-between gap-6">
      <div className="grid gap-5">
        {error && <FormAlert>{error}</FormAlert>}
        {children}
      </div>
      <div className="sticky -bottom-4 -mx-4 grid grid-cols-[auto_1fr] gap-3 border-t-2 border-muted bg-popover px-4 py-3 sm:flex sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant="action" size="lg" disabled={pending}>
          {pending ? t('common.saving') : submitLabel}
        </Button>
      </div>
    </form>
  )
}

/** Interrupteur « Utilisable » commun à tous les référentiels. */
export function ActiveSwitch({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (v: boolean) => void }) {
  const { t } = useTranslation()
  return (
    <SwitchField
      id="is_active"
      label={t('referentials.active_label')}
      hint={t('referentials.active_hint')}
      checked={checked}
      onCheckedChange={onCheckedChange}
    />
  )
}
