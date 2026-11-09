import { useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useId, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FieldError } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCan } from '@/features/auth/hooks'
import type { ReferentialPayload, ReferentialResource } from '@/lib/api/referentials'
import { apiErrorMessage } from '@/lib/form-errors'
import type { Paginated } from '@/types/api'
import type { Permission } from '@/types/auth'
import type { CategoryColor } from '@/types/referentials'
import { useReferentialList, useSaveReferential } from '../hooks'

/** Référentiels qui se créent sur place : le nom suffit. */
type QuickResource = Extract<ReferentialResource, 'categories' | 'expense-categories' | 'brands'>

/** Mêmes droits que l'écran du référentiel (§6.3). */
const PERMISSION: Record<QuickResource, Permission> = {
  categories: 'categories.manage',
  'expense-categories': 'settings.manage',
  brands: 'settings.manage',
}

/** Teintes données à tour de rôle : deux catégories créées à la suite ne se ressemblent pas. */
const COLORS: CategoryColor[] = ['peach', 'yellow', 'mint', 'lavender']

/**
 * « Nouvelle catégorie », « Nouvelle marque »… sous une liste déroulante : le nom se saisit sur place,
 * l'élément est créé puis choisi, sans passer par les paramètres. Pas de `<form>` (il vit dans
 * d'autres formulaires) : Entrée valide le nom.
 */
export function QuickReferentialCreate({ resource, onCreated }: { resource: QuickResource; onCreated: (id: number) => void }) {
  const { t } = useTranslation()
  const can = useCan()
  const id = useId()
  const queryClient = useQueryClient()
  const save = useSaveReferential(resource)
  const active = useReferentialList(resource, { per_page: 100, sort: 'name', filter: { is_active: 'true' } })
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  if (!can(PERMISSION[resource])) return null

  const close = () => {
    setOpen(false)
    setName('')
    setError(null)
  }

  const create = () => {
    const value = name.trim()
    if (!value) return setError(t('referentials.quick.required'))
    setError(null)
    const color = COLORS[(active.data?.meta.total ?? 0) % COLORS.length]!
    const payload = (resource === 'categories' ? { name: value, color, is_active: true } : { name: value, is_active: true }) as ReferentialPayload<QuickResource>
    save.mutate(payload, {
      onSuccess: (item) => {
        // Proposé tout de suite dans les listes, avant leur rechargement.
        queryClient.setQueriesData<Paginated<{ id: number; name: string }>>({ queryKey: ['referentials', resource] }, (old) =>
          old && !old.data.some((x) => x.id === item.id) ? { ...old, data: [...old.data, item].sort((a, b) => a.name.localeCompare(b.name, 'fr')) } : old,
        )
        toast.success(t('referentials.quick.created', { name: item.name }))
        onCreated(item.id)
        close()
      },
      onError: (err) => setError(apiErrorMessage(err)),
    })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Entrée crée l'élément au lieu d'envoyer le formulaire qui l'entoure.
    if (e.key === 'Enter') {
      e.preventDefault()
      create()
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={() => setOpen(true)}>
        <Plus strokeWidth={2.6} aria-hidden="true" />
        {t(`referentials.quick.open.${resource}`)}
      </Button>
    )
  }

  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="sr-only">
        {t(`referentials.quick.open.${resource}`)}
      </label>
      <div className="flex gap-2">
        <Input
          id={id}
          autoFocus
          value={name}
          placeholder={t(`referentials.quick.placeholder.${resource}`)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={onKeyDown}
          className="flex-1"
        />
        <Button type="button" onClick={create} disabled={save.isPending}>
          {save.isPending ? t('common.saving') : t('referentials.quick.add')}
        </Button>
        <Button type="button" variant="ghost" onClick={close} disabled={save.isPending}>
          {t('common.cancel')}
        </Button>
      </div>
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  )
}
