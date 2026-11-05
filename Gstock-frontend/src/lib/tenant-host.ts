/**
 * Domaine principal ou espace (ADR-009) : l'espace est le sous-domaine
 * (`yves-shop.localhost`, `yves-shop.gstock.app`). Sur le domaine principal
 * (`localhost`, `gstock.app`, une adresse IP), la connexion cherche l'espace du compte.
 * Avec les données simulées, il n'y a pas de domaine principal.
 */
export function isCentralHost(hostname = window.location.hostname): boolean {
  if (import.meta.env.VITE_USE_MOCKS === 'true') return false
  if (/^[\d.]+$/.test(hostname) || hostname.includes(':')) return true
  const labels = hostname.split('.')
  return labels.length <= (labels.at(-1) === 'localhost' ? 1 : 2)
}
