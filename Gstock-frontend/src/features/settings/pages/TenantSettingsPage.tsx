import { zodResolver } from '@hookform/resolvers/zod'
import { Info } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { BackLink } from '@/components/BackLink'
import { FormAlert, FormField } from '@/components/FormField'
import { FormActions, FormSection, SwitchField } from '@/components/FormLayout'
import { PageHeader } from '@/components/PageHeader'
import { ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { applyApiErrors } from '@/lib/form-errors'
import type { TenantSettings } from '@/types/settings'
import { useSettings, useUpdateSettings } from '../hooks'
import { TIMEZONES, tenantSettingsSchema, type TenantSettingsForm } from '../schemas'

export function TenantSettingsPage() {
  const { t } = useTranslation()
  const settings = useSettings()

  return (
    <div className="grid gap-6">
      <BackLink to="/parametres" label={t('settings.back')} />
      <PageHeader title={t('settings.tenant.title')} />
      {settings.isPending ? (
        <LoadingState rows={3} />
      ) : settings.isError ? (
        <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />
      ) : (
        <TenantForm settings={settings.data} />
      )}
    </div>
  )
}

function toForm(s: TenantSettings): TenantSettingsForm {
  return {
    name: s.name,
    phone: s.phone ?? '',
    email: s.email ?? '',
    address: s.address ?? '',
    timezone: s.timezone,
    receipt_footer: s.receipt_footer ?? '',
    advanced_mode: s.advanced_mode,
    expiry_alert_days: String(s.expiry_alert_days ?? 7),
  }
}

function TenantForm({ settings }: { settings: TenantSettings }) {
  const { t } = useTranslation()
  const update = useUpdateSettings()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<TenantSettingsForm>({
    resolver: zodResolver(tenantSettingsSchema),
    defaultValues: toForm(settings),
  })
  const { errors, isDirty } = form.formState

  const submit = form.handleSubmit((values) => {
    setFormError(null)
    update.mutate({ ...values, expiry_alert_days: Number(values.expiry_alert_days) }, {
      onSuccess: (data) => {
        form.reset(toForm(data))
        toast.success(t('common.saved'))
      },
      onError: (error) =>
        setFormError(applyApiErrors(error, form.setError, ['name', 'phone', 'email', 'address', 'timezone', 'receipt_footer', 'expiry_alert_days'])),
    })
  })

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      {formError && <FormAlert>{formError}</FormAlert>}

      <FormSection title={t('settings.tenant.identity')}>
        <FormField id="name" label={t('settings.tenant.name')} error={errors.name?.message}>
          <Input autoComplete="organization" {...form.register('name')} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="phone" label={t('settings.tenant.phone')} optional error={errors.phone?.message}>
            <Input type="tel" inputMode="tel" autoComplete="tel" {...form.register('phone')} />
          </FormField>
          <FormField id="email" label={t('settings.tenant.email')} optional error={errors.email?.message}>
            <Input type="email" inputMode="email" autoComplete="email" {...form.register('email')} />
          </FormField>
        </div>
        <FormField id="address" label={t('settings.tenant.address')} optional error={errors.address?.message}>
          <Input autoComplete="street-address" {...form.register('address')} />
        </FormField>
      </FormSection>

      <FormSection title={t('settings.tenant.receipt')}>
        <FormField
          id="receipt_footer"
          label={t('settings.tenant.receipt_footer')}
          optional
          hint={t('settings.tenant.receipt_footer_hint')}
          error={errors.receipt_footer?.message}
        >
          <Textarea rows={2} {...form.register('receipt_footer')} />
        </FormField>
      </FormSection>

      <FormSection title={t('settings.tenant.region')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="currency" label={t('settings.tenant.currency')}>
            <Input value={t('settings.tenant.currency_value')} readOnly disabled />
          </FormField>
          <div className="grid gap-2">
            <label htmlFor="timezone" className="text-sm leading-none font-semibold">
              {t('settings.tenant.timezone')}
            </label>
            <Controller
              control={form.control}
              name="timezone"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
      </FormSection>

      <FormSection title={t('settings.tenant.options')}>
        <Controller
          control={form.control}
          name="advanced_mode"
          render={({ field }) => (
            <SwitchField
              id="advanced_mode"
              label={t('settings.tenant.advanced_mode')}
              hint={t('settings.tenant.advanced_mode_hint')}
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
        <FormField
          id="expiry_alert_days"
          label={t('settings.tenant.expiry_alert_days')}
          hint={t('settings.tenant.expiry_alert_days_hint')}
          error={errors.expiry_alert_days?.message}
          className="sm:max-w-xs"
        >
          <Input inputMode="numeric" className="tabular" {...form.register('expiry_alert_days')} />
        </FormField>
        <p className="flex gap-2 rounded-sm bg-muted p-3 text-sm">
          <Info className="size-5 shrink-0 text-primary" aria-hidden="true" />
          {t('settings.tenant.plan', {
            name: settings.plan.name,
            shops: settings.plan.max_shops,
            users: settings.plan.max_users,
          })}
        </p>
      </FormSection>

      <FormActions>
        <Button type="button" variant="outline" disabled={!isDirty || update.isPending} onClick={() => form.reset()}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant="action" size="lg" disabled={!isDirty || update.isPending}>
          {update.isPending ? t('common.saving') : t('common.save')}
        </Button>
      </FormActions>
    </form>
  )
}
