import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, type DefaultValues, type FieldValues, type Path } from 'react-hook-form'
import { toast } from 'sonner'
import type { z } from 'zod'
import type { ReferentialItem, ReferentialPayload, ReferentialResource } from '@/lib/api/referentials'
import { applyApiErrors } from '@/lib/form-errors'
import i18n from '@/lib/i18n'
import { useSaveReferential } from './hooks'

/** Formulaire d'un référentiel : validation, enregistrement, erreurs du serveur. */
export function useReferentialForm<R extends ReferentialResource, F extends FieldValues>({
  resource,
  item,
  schema,
  defaults,
  toPayload,
  fields,
  onDone,
}: {
  resource: R
  item?: ReferentialItem<R>
  schema: z.ZodType<F, F>
  defaults: DefaultValues<F>
  toPayload: (values: F) => ReferentialPayload<R>
  fields: readonly Path<F>[]
  onDone: () => void
}) {
  const save = useSaveReferential(resource, item?.id)
  const [error, setError] = useState<string | null>(null)
  const form = useForm<F>({ resolver: zodResolver(schema), defaultValues: defaults })

  const submit = form.handleSubmit((values) => {
    setError(null)
    save.mutate(toPayload(values), {
      onSuccess: () => {
        toast.success(item ? i18n.t('common.saved') : i18n.t('referentials.added'))
        onDone()
      },
      onError: (e) => setError(applyApiErrors(e, form.setError, fields)),
    })
  })

  return { form, submit, pending: save.isPending, error }
}
