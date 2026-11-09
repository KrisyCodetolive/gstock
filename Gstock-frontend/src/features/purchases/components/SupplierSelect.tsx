import { Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FormAlert, FormField } from '@/components/FormField'
import { ResponsiveSheet } from '@/components/ResponsiveSheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCan } from '@/features/auth/hooks'
import { ApiError } from '@/lib/api/client'
import { apiErrorMessage } from '@/lib/form-errors'
import type { Supplier } from '@/types/purchases'
import { useSaveSupplier, useSuppliers } from '../hooks'

/** Valeur de la liste quand aucun fournisseur n'est choisi. */
const NONE = 'none'

/**
 * Choix du fournisseur d'un approvisionnement, avec le raccourci « Nouveau fournisseur » :
 * le fournisseur est créé dans un panneau puis choisi, sans quitter l'écran (M11).
 * `value` : identifiant du fournisseur, ou `null` pour « Sans fournisseur ».
 */
export function SupplierSelect({
  id,
  value,
  onChange,
  allowNone = true,
  placeholder,
}: {
  id: string
  value: number | null
  onChange: (id: number | null) => void
  allowNone?: boolean
  placeholder?: string
}) {
  const { t } = useTranslation()
  const can = useCan()
  const suppliers = useSuppliers({ per_page: 100, filter: { is_active: 'true' } })
  // Le fournisseur créé reste proposé pendant que la liste se recharge.
  const [created, setCreated] = useState<Supplier | null>(null)
  const [creating, setCreating] = useState(false)
  const options = suppliers.data?.data ?? []
  const all = created && !options.some((s) => s.id === created.id) ? [created, ...options] : options

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold">
          {t('purchases.form.supplier')}
        </label>
        {can('suppliers.manage') && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setCreating(true)}>
            <Plus strokeWidth={2.6} aria-hidden="true" />
            {t('purchases.supplier_quick.open')}
          </Button>
        )}
      </div>
      <Select value={value === null ? (allowNone ? NONE : undefined) : String(value)} onValueChange={(v) => onChange(v === NONE ? null : Number(v))}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {allowNone && <SelectItem value={NONE}>{t('purchases.form.supplier_none')}</SelectItem>}
          {all.map((s) => (
            <SelectItem key={s.id} value={String(s.id)}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {creating && (
        <QuickSupplierSheet
          onClose={() => setCreating(false)}
          onCreated={(s) => {
            setCreated(s)
            onChange(s.id)
            setCreating(false)
          }}
        />
      )}
    </div>
  )
}

/** Création rapide : le nom suffit, le téléphone est facultatif ; le reste se complète sur la fiche. */
function QuickSupplierSheet({ onClose, onCreated }: { onClose: () => void; onCreated: (s: Supplier) => void }) {
  const { t } = useTranslation()
  const save = useSaveSupplier()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [nameError, setNameError] = useState<string | undefined>()
  const [phoneError, setPhoneError] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    // Le panneau peut s'ouvrir depuis le formulaire d'approvisionnement : ne pas l'envoyer aussi.
    e.preventDefault()
    e.stopPropagation()
    setError(null)
    setPhoneError(undefined)
    if (!name.trim()) {
      setNameError(t('suppliers.form.required_name'))
      return
    }
    setNameError(undefined)
    save.mutate(
      { name: name.trim(), phone: phone.trim() || null, address: null, note: null, is_active: true },
      {
        onSuccess: (s) => {
          toast.success(t('suppliers.form.created'))
          onCreated(s)
        },
        onError: (err) => {
          if (err instanceof ApiError && (err.fieldError('name') || err.fieldError('phone'))) {
            setNameError(err.fieldError('name') ?? undefined)
            setPhoneError(err.fieldError('phone') ?? undefined)
          } else {
            setError(apiErrorMessage(err))
          }
        },
      },
    )
  }

  return (
    <ResponsiveSheet open onOpenChange={(o) => !o && onClose()} title={t('suppliers.new_title')} description={t('purchases.supplier_quick.hint')}>
      <form onSubmit={submit} noValidate className="grid min-h-full content-between gap-6">
        <div className="grid gap-5">
          {error && <FormAlert>{error}</FormAlert>}
          <FormField id="quick-supplier-name" label={t('suppliers.form.name')} error={nameError}>
            <Input autoFocus placeholder={t('suppliers.form.name_placeholder')} value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField id="quick-supplier-phone" label={t('suppliers.form.phone')} error={phoneError} optional>
            <Input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </FormField>
        </div>
        <div className="sticky -bottom-4 -mx-4 grid grid-cols-[auto_1fr] gap-3 border-t-2 border-muted bg-popover px-4 py-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="action" size="lg" disabled={save.isPending}>
            {save.isPending ? t('common.saving') : t('purchases.supplier_quick.submit')}
          </Button>
        </div>
      </form>
    </ResponsiveSheet>
  )
}
