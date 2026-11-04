import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, MailCheck, Send } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { FormAlert, FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { applyApiErrors } from '@/lib/form-errors'
import type { ForgotPasswordResult } from '@/types/auth'
import { PublicCard } from '../components/PublicCard'
import { useForgotPassword } from '../hooks'
import { forgotSchema, type ForgotForm } from '../schemas'

/** Mot de passe oublié (M02) : un lien de réinitialisation est envoyé par e-mail. */
export function ForgotPasswordPage() {
  const { t } = useTranslation()
  const forgot = useForgotPassword()
  const [result, setResult] = useState<ForgotPasswordResult | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<ForgotForm>({ resolver: zodResolver(forgotSchema), defaultValues: { email: '' } })

  const submit = form.handleSubmit((values) => {
    setFormError(null)
    forgot.mutate(values, {
      onSuccess: setResult,
      onError: (error) => setFormError(applyApiErrors(error, form.setError, ['email'])),
    })
  })

  const back = (
    <Link to="/connexion" className="flex min-h-12 items-center justify-center gap-2 font-bold underline-offset-4 hover:underline">
      <ArrowLeft className="size-5" aria-hidden="true" />
      {t('auth.forgot.back')}
    </Link>
  )

  if (result) {
    return (
      <PublicCard title={t('auth.forgot.sent_title')} footer={back}>
        <p className="flex gap-3 rounded-sm border-2 border-foreground bg-tint-mint p-3 font-semibold" role="status">
          <MailCheck className="size-6 shrink-0" aria-hidden="true" />
          {result.message}
        </p>
        <p className="text-sm text-muted-foreground">{t('auth.forgot.no_email_hint')}</p>
        {/* Données simulées : aucun e-mail n'est envoyé, on montre le lien qu'il aurait contenu. */}
        {result.demo_reset_url && (
          <Button asChild variant="outline">
            <Link to={result.demo_reset_url}>{t('auth.forgot.demo_link')}</Link>
          </Button>
        )}
      </PublicCard>
    )
  }

  const { errors } = form.formState
  return (
    <PublicCard title={t('auth.forgot.title')} text={t('auth.forgot.text')} footer={back}>
      <form onSubmit={submit} noValidate className="grid gap-5">
        {formError && <FormAlert>{formError}</FormAlert>}
        <FormField id="email" label={t('auth.forgot.email')} hint={t('auth.forgot.no_email_hint')} error={errors.email?.message}>
          <Input type="email" inputMode="email" autoComplete="email" {...form.register('email')} />
        </FormField>
        <Button type="submit" variant="action" size="lg" disabled={forgot.isPending}>
          <Send aria-hidden="true" />
          {forgot.isPending ? t('auth.forgot.submitting') : t('auth.forgot.submit')}
        </Button>
      </form>
    </PublicCard>
  )
}
