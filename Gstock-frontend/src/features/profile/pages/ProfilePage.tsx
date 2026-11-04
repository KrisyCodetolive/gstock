import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound, Save } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FormAlert, FormField } from '@/components/FormField'
import { FormSection } from '@/components/FormLayout'
import { PageHeader } from '@/components/PageHeader'
import { PasswordInput } from '@/components/PasswordInput'
import { PhotoPicker } from '@/components/PhotoPicker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAvatar, useChangePassword, useSession, useUpdateProfile } from '@/features/auth/hooks'
import { passwordChangeSchema, profileSchema, type PasswordChangeForm, type ProfileForm } from '@/features/auth/schemas'
import { initials } from '@/lib/format'
import { applyApiErrors } from '@/lib/form-errors'
import { roleLabel } from '@/lib/roles'
import type { Me } from '@/types/auth'

/** Mon profil (M02) : photo, nom, coordonnées de connexion, mot de passe. */
export function ProfilePage() {
  const { t } = useTranslation()
  const me = useSession()
  const avatar = useAvatar()

  return (
    <div className="grid gap-6">
      <PageHeader title={t('profile.title')} subtitle={t('user.role', { role: roleLabel(me.role) })} />

      <FormSection title={t('profile.photo')}>
        <PhotoPicker
          id="avatar"
          imageUrl={me.user.avatar_url}
          fallback={<span className="text-2xl font-extrabold">{initials(me.user.firstname, me.user.lastname)}</span>}
          onPick={(file) => avatar.upload.mutateAsync(file)}
          onRemove={() => avatar.remove.mutateAsync()}
          pending={avatar.upload.isPending || avatar.remove.isPending}
          maxSize={256}
        />
      </FormSection>

      <IdentityForm key={me.user.id} me={me} />
      <PasswordForm />

      <p className="text-sm text-muted-foreground">
        {t('profile.shops', { shops: me.shops.map((s) => s.name).join(', ') || '—' })}
      </p>
    </div>
  )
}

function IdentityForm({ me }: { me: Me }) {
  const { t } = useTranslation()
  const save = useUpdateProfile()
  const [formError, setFormError] = useState<string | null>(null)
  const toForm = (m: Me): ProfileForm => ({
    firstname: m.user.firstname,
    lastname: m.user.lastname,
    email: m.user.email ?? '',
    phone: m.user.phone ?? '',
  })
  const form = useForm<ProfileForm>({ resolver: zodResolver(profileSchema), defaultValues: toForm(me) })
  const { errors, isDirty } = form.formState

  const submit = form.handleSubmit((values) => {
    setFormError(null)
    save.mutate(
      { ...values, email: values.email || null, phone: values.phone || null },
      {
        onSuccess: (saved) => {
          form.reset(toForm(saved))
          toast.success(t('common.saved'))
        },
        onError: (error) => setFormError(applyApiErrors(error, form.setError, ['firstname', 'lastname', 'email', 'phone'])),
      },
    )
  })

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      {formError && <FormAlert>{formError}</FormAlert>}
      <FormSection title={t('profile.identity')} description={t('profile.identity_hint')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="firstname" label={t('profile.firstname')} error={errors.firstname?.message}>
            <Input autoComplete="given-name" {...form.register('firstname')} />
          </FormField>
          <FormField id="lastname" label={t('profile.lastname')} error={errors.lastname?.message}>
            <Input autoComplete="family-name" {...form.register('lastname')} />
          </FormField>
          <FormField id="email" label={t('profile.email')} error={errors.email?.message}>
            <Input type="email" inputMode="email" autoComplete="email" {...form.register('email')} />
          </FormField>
          <FormField id="phone" label={t('profile.phone')} error={errors.phone?.message}>
            <Input type="tel" inputMode="tel" autoComplete="tel" {...form.register('phone')} />
          </FormField>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={!isDirty || save.isPending}>
            <Save aria-hidden="true" />
            {save.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </FormSection>
    </form>
  )
}

function PasswordForm() {
  const { t } = useTranslation()
  const change = useChangePassword()
  const [formError, setFormError] = useState<string | null>(null)
  const empty: PasswordChangeForm = { current_password: '', password: '', password_confirmation: '' }
  const form = useForm<PasswordChangeForm>({ resolver: zodResolver(passwordChangeSchema), defaultValues: empty })
  const { errors } = form.formState

  const submit = form.handleSubmit((values) => {
    setFormError(null)
    change.mutate(values, {
      onSuccess: () => {
        form.reset(empty)
        toast.success(t('profile.password.done'))
      },
      onError: (error) =>
        setFormError(applyApiErrors(error, form.setError, ['current_password', 'password', 'password_confirmation'])),
    })
  })

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      {formError && <FormAlert>{formError}</FormAlert>}
      <FormSection title={t('profile.password.title')}>
        <FormField id="current_password" label={t('profile.password.current')} error={errors.current_password?.message}>
          <PasswordInput autoComplete="current-password" {...form.register('current_password')} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="new_password" label={t('auth.reset.password')} hint={t('auth.reset.password_hint')} error={errors.password?.message}>
            <PasswordInput autoComplete="new-password" {...form.register('password')} />
          </FormField>
          <FormField id="password_confirmation" label={t('auth.reset.confirmation')} error={errors.password_confirmation?.message}>
            <PasswordInput autoComplete="new-password" {...form.register('password_confirmation')} />
          </FormField>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={change.isPending}>
            <KeyRound aria-hidden="true" />
            {change.isPending ? t('common.saving') : t('profile.password.submit')}
          </Button>
        </div>
      </FormSection>
    </form>
  )
}
