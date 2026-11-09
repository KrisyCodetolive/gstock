import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { formatAmount, formatDay } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { SalesDay } from '@/types/reports'

const HEIGHT = 180
/** Place à gauche pour les montants de l'axe. */
const AXIS = 44
/** Barre de 24 px au plus, 2 px d'air au moins entre deux barres (design « dataviz »). */
const MAX_BAR = 24
const GAP = 2
/** Au-delà, une barre par semaine : des barres d'un pixel ne se lisent plus. */
const MAX_DAILY_BARS = 62

interface Bar {
  /** Premier et dernier jour couverts par la barre. */
  from: string
  to: string
  total: number
  count: number
}

/** Regroupe les jours par 7 quand la période est longue. */
function toBars(days: SalesDay[]): { bars: Bar[]; weekly: boolean } {
  const daily = days.map((d) => ({ from: d.date, to: d.date, total: Number(d.total), count: d.count }))
  if (days.length <= MAX_DAILY_BARS) return { bars: daily, weekly: false }
  const bars: Bar[] = []
  for (let i = 0; i < daily.length; i += 7) {
    const chunk = daily.slice(i, i + 7)
    bars.push({ from: chunk[0]!.from, to: chunk.at(-1)!.to, total: chunk.reduce((s, d) => s + d.total, 0), count: chunk.reduce((s, d) => s + d.count, 0) })
  }
  return { bars, weekly: true }
}

/** Haut de l'axe arrondi à 1, 2 ou 5 × 10ⁿ : des graduations propres. */
function niceMax(value: number): number {
  if (value <= 0) return 1000
  const power = 10 ** Math.floor(Math.log10(value))
  const step = [1, 2, 5, 10].find((m) => m * power >= value) ?? 10
  return step * power
}

const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 })

/** Largeur de l'élément, suivie au redimensionnement. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry!.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

/**
 * Ventes jour par jour (une seule série : pas de légende, le titre la nomme).
 * Survol, toucher ou flèches du clavier : l'info-bulle donne le jour, le montant et le nombre de ventes.
 * Le détail reste lisible sans survol dans le tableau sous le graphique.
 */
export function SalesChart({ days }: { days: SalesDay[] }) {
  const { t } = useTranslation()
  const [ref, width] = useWidth()
  const { bars, weekly } = toBars(days)
  const [active, setActive] = useState<number | null>(null)
  const max = niceMax(Math.max(0, ...bars.map((b) => b.total)))
  const plot = Math.max(0, width - AXIS)
  const slot = bars.length ? plot / bars.length : 0
  const barWidth = Math.max(1, Math.min(MAX_BAR, slot - GAP))
  const y = (v: number) => HEIGHT - (v / max) * HEIGHT
  const label = (b: Bar) => (weekly ? t('reports.sales.week_of', { from: formatDay(b.from), to: formatDay(b.to) }) : formatDay(b.from))

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const last = bars.length - 1
    setActive((i) => (i === null ? last : Math.max(0, Math.min(last, i + (e.key === 'ArrowLeft' ? -1 : 1)))))
  }

  const current = active === null ? null : bars[active]
  // Repères sous l'axe : début, milieu, fin.
  const ticks = bars.length > 2 ? [0, Math.floor((bars.length - 1) / 2), bars.length - 1] : bars.map((_, i) => i)

  return (
    <div className="grid gap-2">
      {weekly && <p className="text-sm text-muted-foreground">{t('reports.sales.weekly_hint')}</p>}
      <div
        ref={ref}
        className="relative outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-primary"
        tabIndex={0}
        role="group"
        aria-label={t('reports.sales.chart_label', { count: bars.length })}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
        onPointerLeave={() => setActive(null)}
      >
        {width > 0 && (
          <svg width={width} height={HEIGHT + 24} className="block overflow-visible" aria-hidden="true">
            {/* Grille discrète : 0, moitié, haut de l'axe. */}
            {[0, max / 2, max].map((v) => (
              <g key={v}>
                <line x1={AXIS} x2={width} y1={y(v)} y2={y(v)} className="stroke-muted" strokeWidth={1} />
                <text x={AXIS - 6} y={y(v)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] font-semibold">
                  {compact.format(v)}
                </text>
              </g>
            ))}
            {bars.map((b, i) => {
              const h = Math.max(b.total > 0 ? 2 : 0, HEIGHT - y(b.total))
              const x = AXIS + i * slot + (slot - barWidth) / 2
              const r = Math.min(4, barWidth / 2, h)
              return (
                <g key={b.from} onPointerEnter={() => setActive(i)} onPointerDown={() => setActive(i)}>
                  {/* Zone de survol : toute la colonne, plus large que la barre. */}
                  <rect x={AXIS + i * slot} y={0} width={slot} height={HEIGHT} fill="transparent" />
                  {h > 0 && (
                    // Extrémité haute arrondie (4 px), base carrée posée sur l'axe.
                    <path
                      d={`M${x},${HEIGHT} V${HEIGHT - h + r} Q${x},${HEIGHT - h} ${x + r},${HEIGHT - h} H${x + barWidth - r} Q${x + barWidth},${HEIGHT - h} ${x + barWidth},${HEIGHT - h + r} V${HEIGHT} Z`}
                      className={cn('transition-colors', active === i ? 'fill-action' : 'fill-primary')}
                    />
                  )}
                </g>
              )
            })}
            {ticks.map((i) => (
              <text
                key={i}
                x={AXIS + i * slot + slot / 2}
                y={HEIGHT + 16}
                textAnchor={i === 0 ? 'start' : i === bars.length - 1 ? 'end' : 'middle'}
                className="fill-muted-foreground text-[11px] font-semibold"
              >
                {formatDay(bars[i]!.from).slice(0, 5)}
              </text>
            ))}
          </svg>
        )}
        {current && active !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 grid -translate-x-1/2 gap-0.5 rounded-sm border-2 border-foreground bg-card px-3 py-2 text-sm whitespace-nowrap"
            style={{ left: Math.min(Math.max(AXIS + active * slot + slot / 2, 80), width - 80) }}
            aria-live="polite"
          >
            <span className="tabular text-base font-bold">{formatAmount(current.total)} FCFA</span>
            <span className="text-muted-foreground">
              {label(current)} · {t('reports.sales.sales_count', { count: current.count })}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
