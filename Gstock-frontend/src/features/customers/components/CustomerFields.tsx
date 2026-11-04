import type { UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { FormField } from '@/components/FormField'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { CustomerForm } from '../schemas'

/**
 * Champs d'un client, partagés par la fiche et la création rapide de la caisse.
 * `compact` : seulement le nom et le téléphone (données limitées au nécessaire, M10).
 */
export function CustomerFields({ form, compact = false }: { form: UseFormReturn<CustomerForm>; compact?: boolean }) {
  const { t } = useTranslation()
  const { errors } = form.formState
  return (
    <>
      <FormField id="customer-name" label={t('customers.form.name')} error={errors.name?.message}>
        <Input placeholder={t('customers.form.name_placeholder')} autoComplete="off" {...form.register('name')} />
      </FormField>
      <FormField id="customer-phone" label={t('customers.form.phone')} optional hint={t('customers.form.phone_hint')} error={errors.phone?.message}>
        <Input type="tel" inputMode="tel" autoComplete="off" {...form.register('phone')} />
      </FormField>
      {!compact && (
        <>
          <FormField id="customer-district" label={t('customers.form.district')} optional error={errors.district?.message}>
            <Input {...form.register('district')} />
          </FormField>
          <FormField id="customer-note" label={t('customers.form.note')} optional error={errors.note?.message}>
            <Textarea rows={2} placeholder={t('customers.form.note_placeholder')} {...form.register('note')} />
          </FormField>
        </>
      )}
    </>
  )
}
