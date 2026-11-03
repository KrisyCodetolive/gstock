import { zodResolver } from '@hookform/resolvers/zod'
import { DoorClosed, DoorOpen } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { BackLink } from '@/components/BackLink'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormAlert, FormField } from '@/components/FormField'
import { FormActions, FormSection, SwitchField } from '@/components/FormLayout'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage, applyApiErrors } from '@/lib/form-errors'
import type { Shop } from '@/types/settings'
import { useSaveShop, useShop } from '../hooks'
import { formToPayload, SHOP_FIELDS, shopSchema, shopToForm, type ShopForm } from '../schemas'

/** Création (/nouvelle) et modification (/:id) d'une boutique. */
export function ShopFormPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const shopId = id ? Number(id) : undefined
  const shop = useShop(shopId)

  return (
    <div className="grid gap-6">
      <BackLink to="/parametres/boutiques" label={t('shops.back')} />
      {shopId === undefined ? (
        <>
          <PageHeader title={t('shops.new_title')} />
          <ShopFormBody />
        </>
      ) : shop.isPending ? (
        <LoadingState rows={4} />
      ) : shop.isError ? (
        <ErrorState error={shop.error} onRetry={() => void shop.refetch()} />
      ) : (
        <>
          <PageHeader
            title={shop.data.name}
            actions={
              shop.data.is_active ? (
                <StatusBadge tone="paid">{t('shops.open')}</StatusBadge>
              ) : (
                <StatusBadge>{t('shops.closed')}</StatusBadge>
              )
            }
          />
          <ShopFormBody key={shop.data.id} shop={shop.data} />
        </>
      )}
    </div>
  )
}

function ShopFormBody({ shop }: { shop?: Shop }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const save = useSaveShop(shop?.id)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmClose, setConfirmClose] = useState(false)
  const form = useForm<ShopForm>({ resolver: zodResolver(shopSchema), defaultValues: shopToForm(shop) })
  const { errors, isDirty } = form.formState

  const submit = form.handleSubmit((values) => {
    setFormError(null)
    save.mutate(formToPayload(values, shop), {
      onSuccess: (saved) => {
        if (shop) {
          form.reset(shopToForm(saved))
          toast.success(t('common.saved'))
        } else {
          toast.success(t('shops.form.created'))
          navigate(`/parametres/boutiques/${saved.id}`, { replace: true })
        }
      },
      onError: (error) => setFormError(applyApiErrors(error, form.setError, SHOP_FIELDS)),
    })
  })

  const setActive = (is_active: boolean) =>
    save.mutate(
      { ...formToPayload(shopToForm(shop), shop), is_active },
      {
        onSuccess: () => {
          setConfirmClose(false)
          toast.success(is_active ? t('shops.status.reopened_done') : t('shops.status.closed_done'))
        },
        onError: (error) => {
          setConfirmClose(false)
          toast.error(apiErrorMessage(error))
        },
      },
    )

  const bool = (name: 'receipt_show_customer' | 'receipt_show_phone' | 'auto_print_receipt', label: string, hint?: string) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <SwitchField id={name} label={label} hint={hint} checked={field.value} onCheckedChange={field.onChange} />
      )}
    />
  )

  return (
    <div className="grid gap-5">
      <form onSubmit={submit} noValidate className="grid gap-5">
        {formError && <FormAlert>{formError}</FormAlert>}

        <FormSection title={t('shops.form.identity')}>
          <FormField id="name" label={t('shops.form.name')} error={errors.name?.message}>
            <Input placeholder={t('shops.form.name_placeholder')} {...form.register('name')} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="city" label={t('shops.form.city')} error={errors.city?.message}>
              <Input autoComplete="address-level2" {...form.register('city')} />
            </FormField>
            <FormField id="district" label={t('shops.form.district')} optional error={errors.district?.message}>
              <Input {...form.register('district')} />
            </FormField>
          </div>
          <FormField id="address" label={t('shops.form.address')} optional hint={t('shops.form.address_hint')} error={errors.address?.message}>
            <Input {...form.register('address')} />
          </FormField>
          <FormField id="phone" label={t('shops.form.phone')} optional error={errors.phone?.message}>
            <Input type="tel" inputMode="tel" {...form.register('phone')} />
          </FormField>
        </FormSection>

        <FormSection title={t('shops.form.receipt')}>
          <FormField
            id="receipt_note"
            label={t('shops.form.receipt_note')}
            optional
            hint={t('shops.form.receipt_note_hint')}
            error={errors.receipt_note?.message}
          >
            <Textarea rows={2} {...form.register('receipt_note')} />
          </FormField>
          {bool('receipt_show_customer', t('shops.form.show_customer'))}
          {bool('receipt_show_phone', t('shops.form.show_phone'))}
          {bool('auto_print_receipt', t('shops.form.auto_print'), t('shops.form.auto_print_hint'))}
        </FormSection>

        <FormActions>
          <Button
            type="button"
            variant="outline"
            disabled={save.isPending}
            onClick={() => (shop ? form.reset() : navigate('/parametres/boutiques'))}
          >
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="action" size="lg" disabled={save.isPending || (shop && !isDirty)}>
            {save.isPending ? t('common.saving') : shop ? t('common.save') : t('shops.add')}
          </Button>
        </FormActions>
      </form>

      {shop && (
        <>
          <FormSection title={t('shops.status.title')} description={shop.is_active ? t('shops.status.open_text') : t('shops.status.closed_text')}>
            {shop.is_active ? (
              <Button variant="destructive" className="justify-self-start" onClick={() => setConfirmClose(true)}>
                <DoorClosed aria-hidden="true" />
                {t('shops.status.close')}
              </Button>
            ) : (
              <Button variant="outline" className="justify-self-start" disabled={save.isPending} onClick={() => setActive(true)}>
                <DoorOpen aria-hidden="true" />
                {t('shops.status.reopen')}
              </Button>
            )}
          </FormSection>
          <ConfirmDialog
            open={confirmClose}
            onOpenChange={setConfirmClose}
            title={t('shops.status.close_title', { name: shop.name })}
            description={t('shops.status.close_text')}
            confirmLabel={t('shops.status.close')}
            destructive
            pending={save.isPending}
            onConfirm={() => setActive(false)}
          />
        </>
      )}
    </div>
  )
}
