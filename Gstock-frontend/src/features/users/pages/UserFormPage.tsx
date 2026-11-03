import { zodResolver } from '@hookform/resolvers/zod'
import { Crown, UserCheck, UserX } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { BackLink } from '@/components/BackLink'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FieldError, FormAlert, FormField } from '@/components/FormField'
import { FormActions, FormSection } from '@/components/FormLayout'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSession } from '@/features/auth/hooks'
import { useRoles } from '@/features/roles/hooks'
import { useShops } from '@/features/shops/hooks'
import { apiErrorMessage, applyApiErrors } from '@/lib/form-errors'
import i18n from '@/lib/i18n'
import { roleLabel } from '@/lib/roles'
import type { RoleDetail, UserDetail } from '@/types/users'
import type { Shop } from '@/types/settings'
import { useSaveUser, useSetUserStatus, useUser } from '../hooks'

const userSchema = (creating: boolean) =>
  z
    .object({
      firstname: z.string().trim().min(1, i18n.t('users.form.required_firstname')),
      lastname: z.string().trim().min(1, i18n.t('users.form.required_lastname')),
      email: z
        .string()
        .trim()
        .refine((v) => v === '' || z.email().safeParse(v).success, i18n.t('users.form.invalid_email')),
      phone: z.string().trim(),
      password: creating
        ? z.string().min(8, i18n.t('users.form.short_password'))
        : z.string().refine((v) => v === '' || v.length >= 8, i18n.t('users.form.short_password')),
      role_id: z.string().min(1, i18n.t('users.form.required_role')),
      shop_ids: z.array(z.number()).min(1, i18n.t('users.form.required_shops')),
    })
    .refine((v) => v.email !== '' || v.phone !== '', { path: ['email'], message: i18n.t('users.form.required_login') })

type UserForm = z.infer<ReturnType<typeof userSchema>>

/** Création (/nouveau) et modification (/:id) d'un utilisateur. */
export function UserFormPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const userId = id ? Number(id) : undefined
  const user = useUser(userId)
  const roles = useRoles({ per_page: 100 })
  const shops = useShops({ per_page: 100 })

  const pending = roles.isPending || shops.isPending || (userId !== undefined && user.isPending)
  const error = roles.error ?? shops.error ?? user.error

  return (
    <div className="grid gap-6">
      <BackLink to="/parametres/utilisateurs" label={t('users.back')} />
      {pending ? (
        <LoadingState rows={4} />
      ) : error || !roles.data || !shops.data ? (
        <ErrorState error={error} onRetry={() => window.location.reload()} />
      ) : user.data?.role.is_owner ? (
        <OwnerAccount user={user.data} />
      ) : (
        <>
          <PageHeader
            title={user.data ? `${user.data.firstname} ${user.data.lastname}` : t('users.new_title')}
            actions={
              user.data &&
              (user.data.is_active ? (
                <StatusBadge tone="paid">{t('users.active')}</StatusBadge>
              ) : (
                <StatusBadge tone="danger">{t('users.inactive')}</StatusBadge>
              ))
            }
          />
          <UserFormBody
            key={user.data?.id ?? 'new'}
            user={user.data}
            roles={roles.data.data.filter((r) => !r.is_owner)}
            shops={shops.data.data}
          />
        </>
      )}
    </div>
  )
}

function OwnerAccount({ user }: { user: UserDetail }) {
  const { t } = useTranslation()
  return (
    <>
      <PageHeader title={`${user.firstname} ${user.lastname}`} subtitle={roleLabel(user.role)} />
      <p className="flex gap-3 rounded-lg border-2 border-foreground bg-warn-bg p-4 font-semibold">
        <Crown className="size-6 shrink-0 text-warn" aria-hidden="true" />
        {t('users.owner_text')}
      </p>
    </>
  )
}

function UserFormBody({ user, roles, shops }: { user?: UserDetail; roles: RoleDetail[]; shops: Shop[] }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const me = useSession()
  const save = useSaveUser(user?.id)
  const [formError, setFormError] = useState<string | null>(null)

  const toForm = (u?: UserDetail): UserForm => ({
    firstname: u?.firstname ?? '',
    lastname: u?.lastname ?? '',
    email: u?.email ?? '',
    phone: u?.phone ?? '',
    password: '',
    role_id: u ? String(u.role.id) : '',
    // Une seule boutique : elle est cochée d'office.
    shop_ids: u?.shops.map((s) => s.id) ?? (shops.length === 1 ? [shops[0]!.id] : []),
  })
  const form = useForm<UserForm>({ resolver: zodResolver(userSchema(!user)), defaultValues: toForm(user) })
  const { errors, isDirty, dirtyFields } = form.formState

  const submit = form.handleSubmit((values) => {
    setFormError(null)
    save.mutate(
      {
        payload: {
          firstname: values.firstname,
          lastname: values.lastname,
          email: values.email || null,
          phone: values.phone || null,
          role_id: Number(values.role_id),
          ...(values.password ? { password: values.password } : {}),
        },
        shopIds: values.shop_ids,
        shopsChanged: Boolean(dirtyFields.shop_ids),
      },
      {
        onSuccess: (saved) => {
          if (user) {
            form.reset(toForm(saved))
            toast.success(t('common.saved'))
          } else {
            toast.success(t('users.form.created'))
            navigate(`/parametres/utilisateurs/${saved.id}`, { replace: true })
          }
        },
        onError: (error) =>
          setFormError(
            applyApiErrors(error, form.setError, ['firstname', 'lastname', 'email', 'phone', 'password', 'role_id', 'shop_ids']),
          ),
      },
    )
  })

  return (
    <div className="grid gap-5">
      <form onSubmit={submit} noValidate className="grid gap-5">
        {formError && <FormAlert>{formError}</FormAlert>}

        <FormSection title={t('users.form.identity')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="firstname" label={t('users.form.firstname')} error={errors.firstname?.message}>
              <Input autoComplete="off" {...form.register('firstname')} />
            </FormField>
            <FormField id="lastname" label={t('users.form.lastname')} error={errors.lastname?.message}>
              <Input autoComplete="off" {...form.register('lastname')} />
            </FormField>
          </div>
        </FormSection>

        <FormSection title={t('users.form.login')} description={t('users.form.login_hint')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="email" label={t('users.form.email')} error={errors.email?.message}>
              <Input type="email" inputMode="email" autoComplete="off" {...form.register('email')} />
            </FormField>
            <FormField id="phone" label={t('users.form.phone')} error={errors.phone?.message}>
              <Input type="tel" inputMode="tel" autoComplete="off" {...form.register('phone')} />
            </FormField>
          </div>
          <FormField
            id="password"
            label={user ? t('users.form.new_password') : t('users.form.password')}
            hint={user ? t('users.form.new_password_hint') : t('users.form.password_hint')}
            error={errors.password?.message}
          >
            <Input type="password" autoComplete="new-password" {...form.register('password')} />
          </FormField>
        </FormSection>

        <FormSection title={t('users.form.role')} description={t('users.form.role_hint')}>
          <div className="grid gap-2">
            <Controller
              control={form.control}
              name="role_id"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="role_id"
                    aria-label={t('users.form.role')}
                    aria-invalid={errors.role_id ? true : undefined}
                    aria-describedby={errors.role_id ? 'role_id-error' : undefined}
                  >
                    <SelectValue placeholder={t('users.form.role_placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={String(r.id)}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.role_id && <FieldError id="role_id-error">{errors.role_id.message}</FieldError>}
            <Link to="/parametres/roles" className="justify-self-start text-sm font-bold text-primary hover:underline">
              {t('users.form.see_roles')}
            </Link>
          </div>
        </FormSection>

        <FormSection title={t('users.form.shops')} description={t('users.form.shops_hint')}>
          <Controller
            control={form.control}
            name="shop_ids"
            render={({ field }) => (
              <ul className="grid gap-2 sm:grid-cols-2">
                {shops.map((s) => {
                  const id = `shop-${s.id}`
                  const checked = field.value.includes(s.id)
                  return (
                    <li key={s.id}>
                      <label
                        htmlFor={id}
                        className="flex min-h-14 cursor-pointer items-center gap-3 rounded-md border-2 border-foreground bg-card px-3 has-data-[state=checked]:bg-tint-lavender"
                      >
                        <Checkbox
                          id={id}
                          checked={checked}
                          onCheckedChange={(c) => field.onChange(c === true ? [...field.value, s.id] : field.value.filter((v) => v !== s.id))}
                        />
                        <span className="grid">
                          <span className="font-bold">{s.name}</span>
                          <span className="text-sm text-muted-foreground">
                            {[s.district, s.city].filter(Boolean).join(', ')}
                            {!s.is_active && ` · ${t('shops.closed')}`}
                          </span>
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          />
          {errors.shop_ids && <FieldError>{errors.shop_ids.message}</FieldError>}
        </FormSection>

        <FormActions>
          <Button
            type="button"
            variant="outline"
            disabled={save.isPending}
            onClick={() => (user ? form.reset() : navigate('/parametres/utilisateurs'))}
          >
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="action" size="lg" disabled={save.isPending || (user && !isDirty)}>
            {save.isPending ? t('common.saving') : user ? t('common.save') : t('users.add')}
          </Button>
        </FormActions>
      </form>

      {user && <AccountStatus user={user} isSelf={user.id === me.user.id} />}
    </div>
  )
}

function AccountStatus({ user, isSelf }: { user: UserDetail; isSelf: boolean }) {
  const { t } = useTranslation()
  const setStatus = useSetUserStatus(user.id)
  const [confirm, setConfirm] = useState(false)

  const change = (isActive: boolean) =>
    setStatus.mutate(isActive, {
      onSuccess: () => {
        setConfirm(false)
        toast.success(isActive ? t('users.status.reactivated') : t('users.status.deactivated'))
      },
      onError: (error) => {
        setConfirm(false)
        toast.error(apiErrorMessage(error))
      },
    })

  return (
    <FormSection
      title={t('users.status.title')}
      description={isSelf ? t('users.status.self') : user.is_active ? t('users.status.active_text') : t('users.status.inactive_text')}
    >
      {user.is_active ? (
        <Button variant="destructive" className="justify-self-start" disabled={isSelf} onClick={() => setConfirm(true)}>
          <UserX aria-hidden="true" />
          {t('users.status.deactivate')}
        </Button>
      ) : (
        <Button variant="outline" className="justify-self-start" disabled={setStatus.isPending} onClick={() => change(true)}>
          <UserCheck aria-hidden="true" />
          {t('users.status.reactivate')}
        </Button>
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t('users.status.deactivate_title', { name: `${user.firstname} ${user.lastname}` })}
        description={t('users.status.deactivate_text')}
        confirmLabel={t('users.status.deactivate')}
        destructive
        pending={setStatus.isPending}
        onConfirm={() => change(false)}
      />
    </FormSection>
  )
}
