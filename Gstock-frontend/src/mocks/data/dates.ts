// Dates de la démonstration, relatives au jour où elle est générée : l'historique
// couvre toujours le dernier mois jusqu'à aujourd'hui (fuseau Africa/Abidjan = UTC).
const DAY = 86_400_000

const startOfToday = (() => {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d.getTime()
})()

/** Il y a `days` jours, à `hour` heures (UTC). */
export function daysAgo(days: number, hour = 9): string {
  return new Date(startOfToday - days * DAY + hour * 3_600_000).toISOString()
}

/** Date (AAAA-MM-JJ) dans `days` jours (négatif : dans le passé). */
export function dayFromToday(days: number): string {
  return new Date(startOfToday + days * DAY).toISOString().slice(0, 10)
}

export const DEMO_START = startOfToday
