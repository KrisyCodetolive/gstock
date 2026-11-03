import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/** Champ de recherche : la requête part 300 ms après la dernière frappe. */
export function SearchInput({
  value,
  onChange,
  placeholder,
  id = 'search',
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  id?: string
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(value)
  const [synced, setSynced] = useState(value)

  // La valeur change de l'extérieur (lien, bouton retour) : on recale la saisie.
  if (value !== synced) {
    setSynced(value)
    setDraft(value)
  }

  useEffect(() => {
    if (draft === value) return
    const timer = setTimeout(() => onChange(draft), 300)
    return () => clearTimeout(timer)
  }, [draft, value, onChange])

  return (
    <div className="relative w-full sm:max-w-sm">
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>
      <Search className="pointer-events-none absolute top-3.5 left-3 size-5 text-muted-foreground" aria-hidden="true" />
      <Input
        id={id}
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        className="pr-11 pl-10 [&::-webkit-search-cancel-button]:hidden"
      />
      {draft && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-1 right-1"
          onClick={() => {
            setDraft('')
            onChange('')
          }}
          aria-label={t('list.clear_search')}
        >
          <X aria-hidden="true" />
        </Button>
      )}
    </div>
  )
}

/** Pagination simple : précédent, page courante, suivant. */
export function Pagination({
  page,
  lastPage,
  total,
  onPage,
}: {
  page: number
  lastPage: number
  total: number
  onPage: (page: number) => void
}) {
  const { t } = useTranslation()
  if (lastPage <= 1) return null
  return (
    <nav className="flex items-center justify-between gap-3" aria-label={t('list.pagination')}>
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <ChevronLeft aria-hidden="true" />
        {t('list.previous')}
      </Button>
      <span className="text-sm font-semibold text-muted-foreground">
        {t('list.page_of', { page, last: lastPage, total })}
      </span>
      <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => onPage(page + 1)}>
        {t('list.next')}
        <ChevronRight aria-hidden="true" />
      </Button>
    </nav>
  )
}
