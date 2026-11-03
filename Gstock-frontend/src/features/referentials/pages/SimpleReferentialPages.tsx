// Référentiels sans champ particulier : catégories de dépenses et marques.
import { Info } from 'lucide-react'
import { Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { z } from 'zod'
import { FormField } from '@/components/FormField'
import { Input } from '@/components/ui/input'
import { useSettings } from '@/features/settings/hooks'
import i18n from '@/lib/i18n'
import { ReferentialPage, type ReferentialFormProps } from '../components/ReferentialPage'
import { ActiveSwitch, SheetForm } from '../components/SheetForm'
import { referentialTexts } from '../texts'
import { useReferentialForm } from '../use-referential-form'

type NamedResource = 'expense-categories' | 'brands'
type Prefix = 'referentials.expense_categories' | 'referentials.brands'

function namedForm(resource: NamedResource, prefix: Prefix) {
  const schema = z.object({
    name: z.string().trim().min(1, i18n.t(`${prefix}.required_name`)),
    is_active: z.boolean(),
  })

  return function NamedForm({ item, onDone }: ReferentialFormProps<NamedResource>) {
    const { t } = useTranslation()
    const { form, submit, pending, error } = useReferentialForm({
      resource,
      item,
      schema,
      defaults: { name: item?.name ?? '', is_active: item?.is_active ?? true },
      toPayload: (v) => v,
      fields: ['name'],
      onDone,
    })
    return (
      <SheetForm onSubmit={submit} onCancel={onDone} pending={pending} error={error} submitLabel={item ? t('common.save') : t(`${prefix}.add`)}>
        <FormField id="name" label={t('referentials.name')} error={form.formState.errors.name?.message}>
          <Input placeholder={t(`${prefix}.name_placeholder`)} {...form.register('name')} />
        </FormField>
        <Controller control={form.control} name="is_active" render={({ field }) => <ActiveSwitch checked={field.value} onCheckedChange={field.onChange} />} />
      </SheetForm>
    )
  }
}

const ExpenseCategoryForm = namedForm('expense-categories', 'referentials.expense_categories')
const BrandForm = namedForm('brands', 'referentials.brands')

export function ExpenseCategoriesPage() {
  return <ReferentialPage resource="expense-categories" texts={referentialTexts('referentials.expense_categories')} Form={ExpenseCategoryForm} />
}

export function BrandsPage() {
  const { t } = useTranslation()
  const settings = useSettings()
  const notice =
    settings.data && !settings.data.advanced_mode ? (
      <p className="flex gap-2 rounded-sm border-2 border-foreground bg-warn-bg p-3 text-sm font-semibold">
        <Info className="size-5 shrink-0 text-warn" aria-hidden="true" />
        <span>
          {t('referentials.brands.advanced_off')}{' '}
          <Link to="/parametres/espace" className="text-primary underline">
            {t('settings.sections.tenant')}
          </Link>
        </span>
      </p>
    ) : undefined
  return <ReferentialPage resource="brands" texts={referentialTexts('referentials.brands')} notice={notice} Form={BrandForm} />
}
