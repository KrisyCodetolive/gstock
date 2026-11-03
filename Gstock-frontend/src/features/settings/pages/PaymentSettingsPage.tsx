import { zodResolver } from '@hookform/resolvers/zod'
import { PlugZap, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { BackLink } from '@/components/BackLink'
import { FormAlert, FormField } from '@/components/FormField'
import { FormActions, FormSection, SwitchField } from '@/components/FormLayout'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatShortDate } from '@/lib/format'
import { applyApiErrors } from '@/lib/form-errors'
import type { PaymentSettings } from '@/types/settings'
import { usePaymentSettings, useTestPaymentSettings, useUpdatePaymentSettings } from '../hooks'
import { paymentSettingsSchema, type PaymentSettingsForm } from '../schemas'

export function PaymentSettingsPage() {
  const { t } = useTranslation()
  const settings = usePaymentSettings()

  return (
    <div className="grid gap-6">
      <BackLink to="/parametres" label={t('settings.back')} />
      <PageHeader
        title={t('settings.payment.title')}
        subtitle={t('settings.payment.intro')}
        actions={
          settings.data && (
            <StatusBadge tone={settings.data.is_active ? 'paid' : 'neutral'}>
              {settings.data.is_active ? t('settings.payment.status_active') : t('settings.payment.status_inactive')}
            </StatusBadge>
          )
        }
      />
      {settings.isPending ? (
        <LoadingState rows={3} />
      ) : settings.isError ? (
        <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />
      ) : (
        <PaymentForm settings={settings.data} />
      )}
    </div>
  )
}

const empty = (s: PaymentSettings): PaymentSettingsForm => ({
  api_key: '',
  api_secret: '',
  webhook_secret: '',
  is_sandbox: s.is_sandbox,
  is_active: s.is_active,
})

function PaymentForm({ settings }: { settings: PaymentSettings }) {
  const { t } = useTranslation()
  const update = useUpdatePaymentSettings()
  const test = useTestPaymentSettings()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<PaymentSettingsForm>({
    resolver: zodResolver(paymentSettingsSchema),
    defaultValues: empty(settings),
  })
  const { errors, isDirty } = form.formState

  const submit = form.handleSubmit((values) => {
    setFormError(null)
    update.mutate(values, {
      onSuccess: (data) => {
        // Les clés saisies ne restent pas affichées (M03).
        form.reset(empty(data))
        toast.success(t('common.saved'))
      },
      onError: (error) => setFormError(applyApiErrors(error, form.setError, ['api_key', 'api_secret', 'webhook_secret'])),
    })
  })

  const runTest = () =>
    test.mutate(undefined, {
      onSuccess: (result) => (result.ok ? toast.success(result.message) : toast.error(result.message)),
      onError: (error) => toast.error(error.message),
    })

  const savedHint = (has: boolean, hint?: string | null) =>
    has ? (hint ? t('settings.payment.saved_hint', { hint }) : t('settings.payment.saved_hint_short')) : undefined

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      {formError && <FormAlert>{formError}</FormAlert>}

      <FormSection title={t('settings.payment.keys')} description={t('settings.payment.keys_hint')}>
        <FormField
          id="api_key"
          label={t('settings.payment.api_key')}
          hint={savedHint(Boolean(settings.api_key_hint), settings.api_key_hint)}
          error={errors.api_key?.message}
        >
          <Input autoComplete="off" spellCheck={false} {...form.register('api_key')} />
        </FormField>
        <FormField
          id="api_secret"
          label={t('settings.payment.api_secret')}
          hint={savedHint(settings.has_api_secret)}
          error={errors.api_secret?.message}
        >
          <Input type="password" autoComplete="new-password" {...form.register('api_secret')} />
        </FormField>
        <FormField
          id="webhook_secret"
          label={t('settings.payment.webhook_secret')}
          optional
          hint={savedHint(settings.has_webhook_secret)}
          error={errors.webhook_secret?.message}
        >
          <Input type="password" autoComplete="new-password" {...form.register('webhook_secret')} />
        </FormField>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="size-5 shrink-0 text-paid-ink" aria-hidden="true" />
          {settings.updated_at
            ? t('settings.payment.updated_at', { date: formatShortDate(settings.updated_at) })
            : t('settings.payment.keys_hint')}
        </p>
      </FormSection>

      <FormSection title={t('settings.tenant.options')}>
        <Controller
          control={form.control}
          name="is_sandbox"
          render={({ field }) => (
            <SwitchField
              id="is_sandbox"
              label={t('settings.payment.sandbox')}
              hint={t('settings.payment.sandbox_hint')}
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
        <Controller
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <SwitchField
              id="is_active"
              label={t('settings.payment.active')}
              hint={t('settings.payment.active_hint')}
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
      </FormSection>

      <FormActions>
        <Button type="button" variant="outline" disabled={test.isPending || isDirty} onClick={runTest}>
          <PlugZap aria-hidden="true" />
          {test.isPending ? t('settings.payment.testing') : t('settings.payment.test')}
        </Button>
        <Button type="submit" variant="action" size="lg" disabled={!isDirty || update.isPending}>
          {update.isPending ? t('common.saving') : t('common.save')}
        </Button>
      </FormActions>
    </form>
  )
}
