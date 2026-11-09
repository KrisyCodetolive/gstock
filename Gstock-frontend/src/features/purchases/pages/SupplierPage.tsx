import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { BackLink } from '@/components/BackLink'
import { FormAlert, FormField } from '@/components/FormField'
import { FormActions, FormSection, SwitchField } from '@/components/FormLayout'
import { Money } from '@/components/Money'
import { PageHeader } from '@/components/PageHeader'
import { ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useCan } from '@/features/auth/hooks'
import { useCurrentShop } from '@/features/shops/hooks'
import { applyApiErrors } from '@/lib/form-errors'
import { formatShortDate } from '@/lib/format'
import i18n from '@/lib/i18n'
import type { Supplier } from '@/types/purchases'
import { PurchaseStatusBadge } from '../components/PurchaseStatusBadge'
import { SupplierProductsSection } from '../components/SupplierProductsSection'
import { usePurchases, useSaveSupplier, useSupplier } from '../hooks'

const schema = z.object({
  name: z.string().trim().min(1, i18n.t('suppliers.form.required_name')),
  phone: z.string().trim(),
  address: z.string().trim(),
  note: z.string().trim(),
  is_active: z.boolean(),
})
type Form = z.infer<typeof schema>

/** Création (/fournisseurs/nouveau) ou fiche fournisseur (/fournisseurs/:id). */
export function SupplierPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const supplierId = id ? Number(id) : undefined
  const supplier = useSupplier(supplierId)

  return (
    <div className="grid gap-6">
      <BackLink to="/fournisseurs" label={t('suppliers.back')} />
      {supplierId === undefined ? (
        <>
          <PageHeader title={t('suppliers.new_title')} />
          <SupplierForm />
        </>
      ) : supplier.isPending ? (
        <LoadingState rows={3} />
      ) : supplier.isError ? (
        <ErrorState error={supplier.error} onRetry={() => void supplier.refetch()} />
      ) : (
        <>
          <PageHeader title={supplier.data.name} subtitle={[supplier.data.phone, supplier.data.address].filter(Boolean).join(' · ') || undefined} />
          <dl className="grid grid-cols-3 gap-3">
            {[
              { label: t('suppliers.columns.purchased'), value: <Money value={supplier.data.purchased_total} size="md" /> },
              { label: t('suppliers.columns.paid'), value: <Money value={supplier.data.paid_total} size="md" className="text-paid-ink" /> },
              { label: t('suppliers.columns.due'), value: <Money value={supplier.data.due_total} size="md" className={Number(supplier.data.due_total) > 0 ? 'text-destructive' : undefined} /> },
            ].map((tile) => (
              <div key={tile.label} className="grid gap-1 rounded-lg border-2 border-foreground bg-card p-3">
                <dt className="text-sm font-semibold text-muted-foreground">{tile.label}</dt>
                <dd>{tile.value}</dd>
              </div>
            ))}
          </dl>
          <SupplierProductsSection supplierId={supplier.data.id} />
          <SupplierPurchases supplierId={supplier.data.id} />
          <SupplierForm key={supplier.data.id} supplier={supplier.data} />
        </>
      )}
    </div>
  )
}

function SupplierPurchases({ supplierId }: { supplierId: number }) {
  const { t } = useTranslation()
  const { shop } = useCurrentShop()
  const can = useCan()
  const purchases = usePurchases(can('purchases.view') ? shop?.id : undefined, { per_page: 20, filter: { supplier_id: supplierId } })
  if (!can('purchases.view')) return null
  return (
    <FormSection title={t('suppliers.detail.purchases', { shop: shop?.name ?? '' })}>
      {purchases.isPending ? (
        <LoadingState rows={2} />
      ) : purchases.isError ? (
        <ErrorState error={purchases.error} onRetry={() => void purchases.refetch()} />
      ) : purchases.data.data.length === 0 ? (
        <p className="text-muted-foreground">{t('suppliers.detail.no_purchases')}</p>
      ) : (
        <ul className="grid divide-y-2 divide-muted">
          {purchases.data.data.map((p) => (
            <li key={p.id}>
              <Link to={`/approvisionnements/${p.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md px-1 py-3 hover:bg-muted">
                <span className="font-bold">
                  {p.reference} · {formatShortDate(p.occurred_at)}
                </span>
                <span className="flex items-center gap-2">
                  <Money value={p.total} />
                  <PurchaseStatusBadge status={p.payment_status} purchaseStatus={p.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </FormSection>
  )
}

function SupplierForm({ supplier }: { supplier?: Supplier }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const can = useCan()
  const save = useSaveSupplier(supplier?.id)
  const [error, setError] = useState<string | null>(null)
  const toForm = (s?: Supplier): Form => ({ name: s?.name ?? '', phone: s?.phone ?? '', address: s?.address ?? '', note: s?.note ?? '', is_active: s?.is_active ?? true })
  const form = useForm<Form>({ resolver: zodResolver(schema), defaultValues: toForm(supplier) })
  const { errors, isDirty } = form.formState
  if (!can('suppliers.manage')) return null

  const submit = form.handleSubmit((v) => {
    setError(null)
    save.mutate(
      { name: v.name, phone: v.phone || null, address: v.address || null, note: v.note || null, is_active: v.is_active },
      {
        onSuccess: (s) => {
          if (supplier) {
            form.reset(toForm(s))
            toast.success(t('common.saved'))
          } else {
            toast.success(t('suppliers.form.created'))
            navigate(`/fournisseurs/${s.id}`, { replace: true })
          }
        },
        onError: (e) => setError(applyApiErrors(e, form.setError, ['name', 'phone', 'address', 'note'])),
      },
    )
  })

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      {error && <FormAlert>{error}</FormAlert>}
      <FormSection title={t('suppliers.form.identity')}>
        <FormField id="supplier-name" label={t('suppliers.form.name')} error={errors.name?.message}>
          <Input placeholder={t('suppliers.form.name_placeholder')} {...form.register('name')} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="supplier-phone" label={t('suppliers.form.phone')} optional>
            <Input type="tel" inputMode="tel" {...form.register('phone')} />
          </FormField>
          <FormField id="supplier-address" label={t('suppliers.form.address')} optional>
            <Input {...form.register('address')} />
          </FormField>
        </div>
        <FormField id="supplier-note" label={t('suppliers.form.note')} optional>
          <Textarea rows={2} placeholder={t('suppliers.form.note_placeholder')} {...form.register('note')} />
        </FormField>
        {supplier && (
          <Controller
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <SwitchField id="supplier-active" label={t('suppliers.form.active')} hint={t('suppliers.form.active_hint')} checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
        )}
      </FormSection>
      <FormActions>
        <Button type="button" variant="outline" disabled={save.isPending} onClick={() => (supplier ? form.reset() : navigate('/fournisseurs'))}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant="action" size="lg" disabled={save.isPending || (supplier && !isDirty)}>
          {save.isPending ? t('common.saving') : supplier ? t('common.save') : t('suppliers.add')}
        </Button>
      </FormActions>
    </form>
  )
}
