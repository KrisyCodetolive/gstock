import { zodResolver } from '@hookform/resolvers/zod'
import { Crown, Sparkles, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { BackLink } from '@/components/BackLink'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FieldError, FormAlert, FormField } from '@/components/FormField'
import { FormActions, FormSection } from '@/components/FormLayout'
import { PageHeader } from '@/components/PageHeader'
import { ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage, applyApiErrors } from '@/lib/form-errors'
import i18n from '@/lib/i18n'
import { roleLabel } from '@/lib/roles'
import { ALL_PERMISSIONS, type Permission } from '@/types/auth'
import type { PermissionDefinition, RoleDetail } from '@/types/users'
import { PermissionGrid } from '../components/PermissionGrid'
import { ROLE_EXAMPLES } from '../examples'
import { useDeleteRole, usePermissions, useRole, useSaveRole } from '../hooks'

const roleSchema = z.object({
  name: z.string().trim().min(1, i18n.t('roles.form.required_name')),
  description: z.string().trim(),
  permissions: z.array(z.enum(ALL_PERMISSIONS)).min(1, i18n.t('roles.form.required_permissions')),
})
type RoleForm = z.infer<typeof roleSchema>

/** Création (/nouveau) et modification (/:id) d'un rôle. Owner en lecture seule. */
export function RoleFormPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const roleId = id ? Number(id) : undefined
  const role = useRole(roleId)
  const permissions = usePermissions()

  const pending = permissions.isPending || (roleId !== undefined && role.isPending)
  const error = permissions.error ?? role.error

  return (
    <div className="grid gap-6">
      <BackLink to="/parametres/roles" label={t('roles.back')} />
      {pending ? (
        <LoadingState rows={4} />
      ) : error || !permissions.data ? (
        <ErrorState
          error={error}
          onRetry={() => {
            void permissions.refetch()
            if (roleId !== undefined) void role.refetch()
          }}
        />
      ) : role.data?.is_owner ? (
        <OwnerRole role={role.data} definitions={permissions.data} />
      ) : (
        <>
          <PageHeader title={role.data ? role.data.name : t('roles.new_title')} />
          <RoleFormBody key={role.data?.id ?? 'new'} role={role.data} definitions={permissions.data} />
        </>
      )}
    </div>
  )
}

function OwnerRole({ role, definitions }: { role: RoleDetail; definitions: PermissionDefinition[] }) {
  const { t } = useTranslation()
  return (
    <>
      <PageHeader title={roleLabel(role)} />
      <p className="flex gap-3 rounded-lg border-2 border-foreground bg-warn-bg p-4 font-semibold">
        <Crown className="size-6 shrink-0 text-warn" aria-hidden="true" />
        {t('roles.owner_text')}
      </p>
      <PermissionGrid definitions={definitions} value={role.permissions} onChange={() => undefined} readOnly />
    </>
  )
}

function RoleFormBody({ role, definitions }: { role?: RoleDetail; definitions: PermissionDefinition[] }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const save = useSaveRole(role?.id)
  const remove = useDeleteRole()
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const toForm = (r?: RoleDetail): RoleForm => ({
    name: r?.name ?? '',
    description: r?.description ?? '',
    permissions: r?.permissions ?? [],
  })
  const form = useForm<RoleForm>({ resolver: zodResolver(roleSchema), defaultValues: toForm(role) })
  const { errors, isDirty } = form.formState
  const selected = useWatch({ control: form.control, name: 'permissions' })

  const submit = form.handleSubmit((values) => {
    setFormError(null)
    save.mutate(
      { name: values.name, description: values.description || null, permissions: values.permissions },
      {
        onSuccess: (saved) => {
          if (role) {
            form.reset(toForm(saved))
            toast.success(t('common.saved'))
          } else {
            toast.success(t('roles.form.created'))
            navigate(`/parametres/roles/${saved.id}`, { replace: true })
          }
        },
        onError: (error) => setFormError(applyApiErrors(error, form.setError, ['name', 'description', 'permissions'])),
      },
    )
  })

  const applyExample = (permissions: Permission[], label: string) => {
    form.setValue('permissions', permissions, { shouldDirty: true, shouldValidate: true })
    toast.info(t('roles.form.example_applied', { name: label }))
  }

  return (
    <div className="grid gap-5">
      <form onSubmit={submit} noValidate className="grid gap-5">
        {formError && <FormAlert>{formError}</FormAlert>}

        <FormSection title={t('roles.form.identity')}>
          <FormField id="name" label={t('roles.form.name')} error={errors.name?.message}>
            <Input placeholder={t('roles.form.name_placeholder')} {...form.register('name')} />
          </FormField>
          <FormField id="description" label={t('roles.form.description')} optional error={errors.description?.message}>
            <Textarea rows={2} placeholder={t('roles.form.description_placeholder')} {...form.register('description')} />
          </FormField>
        </FormSection>

        <FormSection title={t('roles.form.examples')} description={t('roles.form.examples_hint')}>
          <div className="flex flex-wrap gap-2">
            {ROLE_EXAMPLES.map((ex) => (
              <Button key={ex.id} type="button" variant="outline" size="sm" onClick={() => applyExample(ex.permissions, t(ex.label))}>
                <Sparkles aria-hidden="true" />
                {t(ex.label)}
              </Button>
            ))}
          </div>
        </FormSection>

        <section className="grid gap-3" aria-labelledby="perms-title">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 id="perms-title" className="text-xl font-bold">
              {t('roles.form.permissions')}
            </h2>
            <span className="text-sm font-bold text-primary" aria-live="polite">
              {t('roles.form.selected', { count: selected.length })}
            </span>
          </div>
          {role && role.users_count > 0 && (
            <p className="text-sm text-muted-foreground">{t('roles.form.applies_now', { count: role.users_count })}</p>
          )}
          {errors.permissions && <FieldError>{errors.permissions.message}</FieldError>}
          <Controller
            control={form.control}
            name="permissions"
            render={({ field }) => <PermissionGrid definitions={definitions} value={field.value} onChange={field.onChange} />}
          />
        </section>

        <FormActions>
          <Button
            type="button"
            variant="outline"
            disabled={save.isPending}
            onClick={() => (role ? form.reset() : navigate('/parametres/roles'))}
          >
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="action" size="lg" disabled={save.isPending || (role && !isDirty)}>
            {save.isPending ? t('common.saving') : role ? t('common.save') : t('roles.add')}
          </Button>
        </FormActions>
      </form>

      {role && (
        <FormSection
          title={t('roles.delete.title')}
          description={role.users_count > 0 ? t('roles.delete.blocked', { count: role.users_count }) : t('roles.delete.free')}
        >
          <Button
            variant="destructive"
            className="justify-self-start"
            disabled={role.users_count > 0}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 aria-hidden="true" />
            {t('roles.delete.button')}
          </Button>
          <ConfirmDialog
            open={confirmDelete}
            onOpenChange={setConfirmDelete}
            title={t('roles.delete.confirm_title', { name: role.name })}
            description={t('roles.delete.confirm_text')}
            confirmLabel={t('roles.delete.button')}
            destructive
            pending={remove.isPending}
            onConfirm={() =>
              remove.mutate(role.id, {
                onSuccess: () => {
                  toast.success(t('roles.delete.done'))
                  navigate('/parametres/roles', { replace: true })
                },
                onError: (error) => {
                  setConfirmDelete(false)
                  toast.error(apiErrorMessage(error))
                },
              })
            }
          />
        </FormSection>
      )}
    </div>
  )
}
