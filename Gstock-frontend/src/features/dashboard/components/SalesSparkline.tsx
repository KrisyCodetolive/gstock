import { useTranslation } from 'react-i18next'
import { formatShortDate } from '@/lib/format'
import type { Dashboard } from '@/types/dashboard'

const W = 200
const H = 48
/** Marge haute et basse : le trait de 2 px et le point du dernier jour ne sont pas coupés. */
const PAD = 5

const amount = (v: number) => v.toLocaleString('fr-FR')

/**
 * Mini-courbe des ventes jour par jour, dans la carte « Ventes » de l'accueil (M13).
 * Une seule série, sans axe : le point marque aujourd'hui, la plus haute journée est écrite en clair.
 * La carte est un lien : la courbe reste décorative pour la souris, résumée en texte pour les lecteurs d'écran ;
 * le détail jour par jour est dans les rapports.
 */
export function SalesSparkline({ trend }: { trend: NonNullable<Dashboard['trend']> }) {
  const { t } = useTranslation()
  if (trend.length < 2) return null
  const values = trend.map((d) => Number(d.total))
  const max = Math.max(...values)
  const best = trend[values.indexOf(max)]!
  const x = (i: number) => (i / (trend.length - 1)) * W
  const y = (v: number) => (max > 0 ? H - PAD - (v / max) * (H - 2 * PAD) : H - PAD)
  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ')
  const last = values[values.length - 1]!
  const summary =
    max > 0
      ? t('home.trend.summary', { count: trend.length, best: amount(max), date: formatShortDate(best.date), today: amount(last) })
      : t('home.trend.empty', { count: trend.length })

  return (
    <span className="mt-2 grid gap-1">
      <span className="relative block h-12" aria-hidden="true">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
          <line x1={0} x2={W} y1={H - PAD} y2={H - PAD} className="stroke-muted" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <path d={`${line} L${W},${H - PAD} L0,${H - PAD} Z`} className="fill-primary/15" />
          <path d={line} fill="none" className="stroke-primary" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {/* Point d'aujourd'hui, en HTML pour rester rond quelle que soit la largeur de la carte. */}
        <span
          className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary"
          style={{ left: '100%', top: `${(y(last) / H) * 100}%` }}
        />
      </span>
      <span className="flex justify-between gap-2 text-xs text-muted-foreground" aria-hidden="true">
        <span>{t('home.trend.days', { count: trend.length })}</span>
        {max > 0 && <span>{t('home.trend.best', { amount: amount(max), date: formatShortDate(best.date) })}</span>}
      </span>
      <span className="sr-only">{summary}</span>
    </span>
  )
}
