import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound, LinkIcon } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { FormAlert, FormField } from '@/components/FormField'
import { PasswordInput } from '@/components/PasswordInput'
import { Button } from '@/components/ui/button'
import { applyApiErrors } from '@/lib/form-errors'
import { PublicCard } from '../components/PublicCard'
import { useResetPassword } from '../hooks'
import { resetSchema, type ResetForm } from '../schemas'

/** Lien reçu par e-mail : choisir un nouveau mot de passe, puis se reconnecter. */
export function ResetPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('jeton') ?? ''
  const reset = useResetPassword()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<ResetForm>({ resolver: zodResolver(resetSchema), defaultValues: { password: '', password_confirmation: '' } })

  const submit = form.handleSubmit((values) => {
    setFormError(null)
    reset.mutate(
      { token, ...values },
      {
        onSuccess: () => {
          toast.success(t('auth.reset.done'))
          void navigate('/connexion', { replace: true, state: { loggedOut: true } })
        },
        onError: (error) => setFormError(applyApiErrors(error, form.setError, ['password', 'password_confirmation'])),
      },
    )
  })

  const newLink = (
    <Button asChild variant="outline">
      <Link to="/mot-de-passe-oublie">
        <LinkIcon aria-hidden="true" />
        {t('auth.reset.new_link')}
      </Link>
    </Button>
  )

  if (!token) {
    return (
      <PublicCard title={t('auth.reset.title')}>
        <FormAlert>{t('auth.reset.missing')}</FormAlert>
        {newLink}
      </PublicCard>
    )
  }

  const { errors } = form.formState
  return (
    <PublicCard title={t('auth.reset.title')} text={t('auth.reset.text')}>
      <form onSubmit={submit} noValidate className="grid gap-5">
        {formError && <FormAlert>{formError}</FormAlert>}
        {formError && newLink}
        <FormField id="password" label={t('auth.reset.password')} hint={t('auth.reset.password_hint')} error={errors.password?.message}>
          <PasswordInput autoComplete="new-password" {...form.register('password')} />
        </FormField>
        <FormField id="password_confirmation" label={t('auth.reset.confirmation')} error={errors.password_confirmation?.message}>
          <PasswordInput autoComplete="new-password" {...form.register('password_confirmation')} />
        </FormField>
        <Button type="submit" variant="action" size="lg" disabled={reset.isPending}>
          <KeyRound aria-hidden="true" />
          {reset.isPending ? t('auth.reset.submitting') : t('auth.reset.submit')}
        </Button>
      </form>
    </PublicCard>
  )
}
