import type { ReportQuery } from '@/types/reports'

export type PeriodPreset = '7d' | '30d' | 'month' | 'last_month' | 'custom'

export const PRESETS: PeriodPreset[] = ['7d', '30d', 'month', 'last_month', 'custom']

/** Jour au fuseau de l'espace (Africa/Abidjan = UTC), comme le serveur. */
const ymd = (d: Date) => d.toISOString().slice(0, 10)

export function today(): string {
  return ymd(new Date())
}

/** Dates d'un raccourci de période ; « custom » garde les dates saisies. */
export function presetRange(preset: Exclude<PeriodPreset, 'custom'>): ReportQuery {
  const now = new Date()
  const day = (offset: number) => ymd(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset)))
  switch (preset) {
    case '7d':
      return { from: day(-6), to: day(0) }
    case '30d':
      return { from: day(-29), to: day(0) }
    case 'month':
      return { from: ymd(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))), to: day(0) }
    case 'last_month':
      return {
        from: ymd(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))),
        to: ymd(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0))),
      }
  }
}
