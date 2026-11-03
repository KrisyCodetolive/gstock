import { Banknote, CreditCard, Smartphone, Wallet, type LucideIcon } from 'lucide-react'
import { Controller, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { FormField } from '@/components/FormField'
import { SwitchField } from '@/components/FormLayout'
import { StatusBadge } from '@/components/StatusBadge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import i18n from '@/lib/i18n'
import type { PaymentMethodType } from '@/types/referentials'
import { ReferentialPage, type ReferentialFormProps } from '../components/ReferentialPage'
import { ActiveSwitch, SheetForm } from '../components/SheetForm'
import { referentialTexts } from '../texts'
import { useReferentialForm } from '../use-referential-form'

const TYPES: PaymentMethodType[] = ['cash', 'mobile_money', 'card', 'other']
const ICONS: Record<PaymentMethodType, LucideIcon> = { cash: Banknote, mobile_money: Smartphone, card: CreditCard, other: Wallet }
/** GeniusPay ne concerne que le Mobile Money et la carte (ADR-003). */
const ONLINE: PaymentMethodType[] = ['mobile_money', 'card']

const schema = z.object({
  name: z.string().trim().min(1, i18n.t('referentials.payment_methods.required_name')),
  type: z.enum(TYPES),
  uses_geniuspay: z.boolean(),
  is_active: z.boolean(),
})

function PaymentMethodForm({ item, onDone }: ReferentialFormProps<'payment-methods'>) {
  const { t } = useTranslation()
  const { form, submit, pending, error } = useReferentialForm({
    resource: 'payment-methods',
    item,
    schema,
    defaults: {
      name: item?.name ?? '',
      type: item?.type ?? 'mobile_money',
      uses_geniuspay: item?.uses_geniuspay ?? false,
      is_active: item?.is_active ?? true,
    },
    toPayload: (v) => ({ ...v, uses_geniuspay: ONLINE.includes(v.type) && v.uses_geniuspay }),
    fields: ['name', 'type'],
    onDone,
  })
  const type = useWatch({ control: form.control, name: 'type' })

  return (
    <SheetForm onSubmit={submit} onCancel={onDone} pending={pending} error={error} submitLabel={item ? t('common.save') : t('referentials.payment_methods.add')}>
      <FormField id="name" label={t('referentials.name')} error={form.formState.errors.name?.message}>
        <Input placeholder={t('referentials.payment_methods.name_placeholder')} {...form.register('name')} />
      </FormField>
      <div className="grid gap-2">
        <label htmlFor="type" className="text-sm font-semibold">
          {t('referentials.payment_methods.type')}
        </label>
        <Controller
          control={form.control}
          name="type"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((ty) => (
                  <SelectItem key={ty} value={ty}>
                    {t(`referentials.payment_methods.types.${ty}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
      {ONLINE.includes(type) && (
        <Controller
          control={form.control}
          name="uses_geniuspay"
          render={({ field }) => (
            <SwitchField
              id="uses_geniuspay"
              label={t('referentials.payment_methods.geniuspay')}
              hint={t('referentials.payment_methods.geniuspay_hint')}
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
      )}
      <Controller control={form.control} name="is_active" render={({ field }) => <ActiveSwitch checked={field.value} onCheckedChange={field.onChange} />} />
    </SheetForm>
  )
}

export function PaymentMethodsPage() {
  const { t } = useTranslation()
  return (
    <ReferentialPage
      resource="payment-methods"
      texts={referentialTexts('referentials.payment_methods')}
      leading={(m) => {
        const Icon = ICONS[m.type]
        return <Icon className="size-5 shrink-0" aria-hidden="true" />
      }}
      details={(m) => (
        <span className="inline-flex flex-wrap items-center gap-2">
          {t(`referentials.payment_methods.types.${m.type}`)}
          {m.uses_geniuspay && <StatusBadge>{t('referentials.payment_methods.geniuspay_badge')}</StatusBadge>}
        </span>
      )}
      Form={PaymentMethodForm}
    />
  )
}
