import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { cn } from '@/lib/utils'

export interface Column<T> {
  header: string
  cell: (item: T) => ReactNode
  className?: string
}

/**
 * Liste responsive (§3.4) : cartes empilées sur mobile, tableau sur desktop.
 * Chaque carte et chaque ligne mène au détail de l'élément (§3.3).
 */
export function DataList<T>({
  items,
  getKey,
  to,
  onSelect,
  columns,
  card,
  label,
}: {
  items: T[]
  getKey: (item: T) => string | number
  /** Lien vers le détail, ou… */
  to?: (item: T) => string
  /** … action au toucher (ouvrir un panneau). */
  onSelect?: (item: T) => void
  columns: Column<T>[]
  card: (item: T) => ReactNode
  /** Nom accessible du tableau. */
  label: string
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const open = (item: T) => (to ? navigate(to(item)) : onSelect?.(item))

  return (
    <>
      <ul className="grid gap-3 lg:hidden">
        {items.map((item) => {
          const content = (
            <>
              <div className="min-w-0 flex-1">{card(item)}</div>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            </>
          )
          const className = 'pressable-lg flex w-full items-center gap-3 rounded-lg bg-card p-4 text-left'
          return (
            <li key={getKey(item)}>
              {to ? (
                <Link to={to(item)} className={className}>
                  {content}
                </Link>
              ) : (
                <button type="button" onClick={() => onSelect?.(item)} className={className}>
                  {content}
                </button>
              )}
            </li>
          )
        })}
      </ul>

      <div className="hidden overflow-x-auto rounded-lg border-2 border-foreground bg-card shadow-hard lg:block">
        <table className="w-full text-left text-[15px]" aria-label={label}>
          <thead className="border-b-2 border-foreground bg-muted text-sm">
            <tr>
              {columns.map((col) => (
                <th key={col.header} scope="col" className={cn('px-4 py-3 font-bold', col.className)}>
                  {col.header}
                </th>
              ))}
              <th scope="col" className="w-10">
                <span className="sr-only">{t('common.open')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={getKey(item)}
                onClick={() => open(item)}
                className="cursor-pointer border-b-2 border-muted last:border-b-0 hover:bg-[color-mix(in_srgb,var(--card),var(--muted)_50%)]"
              >
                {columns.map((col, i) => (
                  <td key={col.header} className={cn('px-4 py-3 align-middle', col.className)}>
                    {i === 0 && to ? (
                      <Link to={to(item)} className="font-bold hover:underline" onClick={(e) => e.stopPropagation()}>
                        {col.cell(item)}
                      </Link>
                    ) : i === 0 && onSelect ? (
                      <button
                        type="button"
                        className="text-left font-bold hover:underline"
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelect(item)
                        }}
                      >
                        {col.cell(item)}
                      </button>
                    ) : (
                      col.cell(item)
                    )}
                  </td>
                ))}
                <td className="pr-3 text-muted-foreground">
                  <ChevronRight className="size-5" aria-hidden="true" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
