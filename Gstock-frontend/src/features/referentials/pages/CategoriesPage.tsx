import { Check } from 'lucide-react'
import { Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { FormField } from '@/components/FormField'
import { Input } from '@/components/ui/input'
import i18n from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { CategoryColor } from '@/types/referentials'
import { ReferentialPage, type ReferentialFormProps } from '../components/ReferentialPage'
import { ActiveSwitch, SheetForm } from '../components/SheetForm'
import { referentialTexts } from '../texts'
import { useReferentialForm } from '../use-referential-form'

const COLORS: CategoryColor[] = ['peach', 'yellow', 'mint', 'lavender']
const swatch: Record<CategoryColor, string> = {
  peach: 'bg-tint-peach',
  yellow: 'bg-tint-yellow',
  mint: 'bg-tint-mint',
  lavender: 'bg-tint-lavender',
}

const schema = z.object({
  name: z.string().trim().min(1, i18n.t('referentials.categories.required_name')),
  color: z.enum(COLORS),
  is_active: z.boolean(),
})

function CategoryForm({ item, onDone }: ReferentialFormProps<'categories'>) {
  const { t } = useTranslation()
  const { form, submit, pending, error } = useReferentialForm({
    resource: 'categories',
    item,
    schema,
    defaults: { name: item?.name ?? '', color: item?.color ?? 'lavender', is_active: item?.is_active ?? true },
    toPayload: (v) => v,
    fields: ['name', 'color'],
    onDone,
  })

  return (
    <SheetForm onSubmit={submit} onCancel={onDone} pending={pending} error={error} submitLabel={item ? t('common.save') : t('referentials.categories.add')}>
      <FormField id="name" label={t('referentials.name')} error={form.formState.errors.name?.message}>
        <Input placeholder={t('referentials.categories.name_placeholder')} {...form.register('name')} />
      </FormField>
      <Controller
        control={form.control}
        name="color"
        render={({ field }) => (
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-semibold">{t('referentials.categories.color')}</legend>
            <div className="flex flex-wrap gap-3" role="radiogroup">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={field.value === c}
                  aria-label={t(`referentials.categories.colors.${c}`)}
                  onClick={() => field.onChange(c)}
                  className={cn('pressable grid size-12 place-items-center rounded-md', swatch[c])}
                >
                  {field.value === c && <Check className="size-6" strokeWidth={3} aria-hidden="true" />}
                </button>
              ))}
            </div>
          </fieldset>
        )}
      />
      <Controller control={form.control} name="is_active" render={({ field }) => <ActiveSwitch checked={field.value} onCheckedChange={field.onChange} />} />
    </SheetForm>
  )
}

export function CategoriesPage() {
  return (
    <ReferentialPage
      resource="categories"
      texts={referentialTexts('referentials.categories')}
      leading={(c) => <span className={cn('size-5 shrink-0 rounded-sm border-2 border-foreground', swatch[c.color])} aria-hidden="true" />}
      Form={CategoryForm}
    />
  )
}
