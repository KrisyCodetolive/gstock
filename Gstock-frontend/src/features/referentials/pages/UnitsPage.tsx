import { Controller, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { FieldError, FormField } from '@/components/FormField'
import { SwitchField } from '@/components/FormLayout'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import i18n from '@/lib/i18n'
import type { Unit } from '@/types/referentials'
import { ReferentialPage, type ReferentialFormProps } from '../components/ReferentialPage'
import { ActiveSwitch, SheetForm } from '../components/SheetForm'
import { useReferentialList } from '../hooks'
import { referentialTexts } from '../texts'
import { useReferentialForm } from '../use-referential-form'

const schema = z
  .object({
    name: z.string().trim().min(1, i18n.t('referentials.units.required_name')),
    short_name: z.string().trim().min(1, i18n.t('referentials.units.required_short_name')),
    derived: z.boolean(),
    base_unit_id: z.string(),
    operator: z.enum(['*', '/']),
    operator_value: z.string().trim(),
    is_active: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (!v.derived) return
    if (!v.base_unit_id) ctx.addIssue({ code: 'custom', path: ['base_unit_id'], message: i18n.t('referentials.units.required_base') })
    const n = Number(v.operator_value.replace(',', '.'))
    if (!(n > 0)) ctx.addIssue({ code: 'custom', path: ['operator_value'], message: i18n.t('referentials.units.invalid_value') })
  })

/** « 1 Carton = 12 Unité » ou « 1000 Gramme = 1 Kilogramme » (§7.3). */
function conversion(unit: Pick<Unit, 'name' | 'operator' | 'operator_value'>, base: string) {
  const value = Number(unit.operator_value)
  return unit.operator === '*'
    ? i18n.t('referentials.units.preview_multiply', { unit: unit.name, value, base })
    : i18n.t('referentials.units.preview_divide', { unit: unit.name, value, base })
}

function useBaseUnits() {
  return useReferentialList('units', { per_page: 100, sort: 'name' })
}

function UnitForm({ item, onDone }: ReferentialFormProps<'units'>) {
  const { t } = useTranslation()
  const units = useBaseUnits()
  // Une unité dérivée se rattache à une unité de base (pas à elle-même, pas à une autre dérivée).
  const bases = units.data?.data.filter((u) => u.base_unit_id === null && u.id !== item?.id) ?? []

  const { form, submit, pending, error } = useReferentialForm({
    resource: 'units',
    item,
    schema,
    defaults: {
      name: item?.name ?? '',
      short_name: item?.short_name ?? '',
      derived: item ? item.base_unit_id !== null : false,
      base_unit_id: item?.base_unit_id ? String(item.base_unit_id) : '',
      operator: item?.operator ?? '*',
      operator_value: item?.operator_value ?? '',
      is_active: item?.is_active ?? true,
    },
    toPayload: (v) => ({
      name: v.name,
      short_name: v.short_name,
      base_unit_id: v.derived ? Number(v.base_unit_id) : null,
      operator: v.derived ? v.operator : null,
      operator_value: v.derived ? String(Number(v.operator_value.replace(',', '.'))) : null,
      is_active: v.is_active,
    }),
    fields: ['name', 'short_name', 'base_unit_id', 'operator', 'operator_value'],
    onDone,
  })
  const { errors } = form.formState
  const [derived, name, baseId, operator, value] = useWatch({
    control: form.control,
    name: ['derived', 'name', 'base_unit_id', 'operator', 'operator_value'],
  })
  const baseName = bases.find((b) => String(b.id) === baseId)?.name
  const numeric = Number(value.replace(',', '.'))

  return (
    <SheetForm onSubmit={submit} onCancel={onDone} pending={pending} error={error} submitLabel={item ? t('common.save') : t('referentials.units.add')}>
      <div className="grid grid-cols-[1fr_8rem] gap-4">
        <FormField id="name" label={t('referentials.name')} error={errors.name?.message}>
          <Input placeholder={t('referentials.units.name_placeholder')} {...form.register('name')} />
        </FormField>
        <FormField id="short_name" label={t('referentials.units.short_name')} error={errors.short_name?.message}>
          <Input placeholder={t('referentials.units.short_name_placeholder')} {...form.register('short_name')} />
        </FormField>
      </div>

      <Controller
        control={form.control}
        name="derived"
        render={({ field }) => (
          <SwitchField
            id="derived"
            label={t('referentials.units.derived')}
            hint={t('referentials.units.derived_hint')}
            checked={field.value}
            onCheckedChange={field.onChange}
          />
        )}
      />

      {derived && (
        <div className="grid gap-4 rounded-md border-2 border-foreground bg-muted p-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <label htmlFor="operator" className="text-sm font-semibold">
                {t('referentials.units.relation')}
              </label>
              <Controller
                control={form.control}
                name="operator"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="operator">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="*">{t('referentials.units.relation_multiply')}</SelectItem>
                      <SelectItem value="/">{t('referentials.units.relation_divide')}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="base_unit_id" className="text-sm font-semibold">
                {t('referentials.units.base_unit')}
              </label>
              <Controller
                control={form.control}
                name="base_unit_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="base_unit_id" aria-invalid={errors.base_unit_id ? true : undefined}>
                      <SelectValue placeholder={t('referentials.units.base_unit_placeholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {bases.map((b) => (
                        <SelectItem key={b.id} value={String(b.id)}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.base_unit_id && <FieldError>{errors.base_unit_id.message}</FieldError>}
            </div>
          </div>
          <FormField id="operator_value" label={t('referentials.units.value')} error={errors.operator_value?.message}>
            <Input inputMode="decimal" className="tabular" {...form.register('operator_value')} />
          </FormField>
          {name && baseName && numeric > 0 && (
            <p className="text-base font-bold text-primary" aria-live="polite">
              {conversion({ name, operator, operator_value: String(numeric) }, baseName)}
            </p>
          )}
        </div>
      )}

      <Controller control={form.control} name="is_active" render={({ field }) => <ActiveSwitch checked={field.value} onCheckedChange={field.onChange} />} />
    </SheetForm>
  )
}

export function UnitsPage() {
  const { t } = useTranslation()
  const units = useBaseUnits()
  const nameOf = (id: number) => units.data?.data.find((u) => u.id === id)?.name ?? '…'

  return (
    <ReferentialPage
      resource="units"
      texts={referentialTexts('referentials.units')}
      details={(u) =>
        u.base_unit_id === null ? `${u.short_name} · ${t('referentials.units.base')}` : `${u.short_name} · ${conversion(u, nameOf(u.base_unit_id))}`
      }
      Form={UnitForm}
    />
  )
}
