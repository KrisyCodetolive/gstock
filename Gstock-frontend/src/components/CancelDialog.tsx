import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { FormAlert } from '@/components/FormField'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

/**
 * Annulation d'une opération : motif obligatoire, jamais de suppression (ADR-012).
 * `onConfirm` renvoie une erreur à afficher, ou null en cas de succès.
 */
export function CancelDialog({
  open,
  onOpenChange,
  title,
  description,
  reasonLabel,
  requiredMessage,
  confirmLabel,
  pending,
  onConfirm,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  reasonLabel: string
  requiredMessage: string
  confirmLabel: string
  pending: boolean
  onConfirm: (reason: string) => Promise<string | null>
  /** Choix supplémentaires (par exemple avoir ou argent rendu, décision P3). */
  children?: ReactNode
}) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const confirm = async () => {
    if (!reason.trim()) {
      setError(requiredMessage)
      return
    }
    const failure = await onConfirm(reason.trim())
    if (failure) setError(failure)
    else {
      setReason('')
      onOpenChange(false)
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) setError(null)
      }}
    >
      <AlertDialogContent className="max-h-[92dvh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="cancel_reason">{reasonLabel}</Label>
          <Textarea id="cancel_reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={error === requiredMessage ? true : undefined} />
        </div>
        {children}
        {error && <FormAlert>{error}</FormAlert>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t('common.cancel')}</AlertDialogCancel>
          <Button variant="destructive" disabled={pending} onClick={() => void confirm()}>
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
