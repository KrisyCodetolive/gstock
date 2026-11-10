/**
 * Domaine principal ou espace (ADR-009) : l'espace est le sous-domaine
 * (`yves-shop.localhost`, `yves-shop.gstock.app`). Sur le domaine principal
 * (`localhost`, `gstock.app`, une adresse IP), la connexion cherche l'espace du compte.
 *
 * En production, VITE_CENTRAL_DOMAIN (fixé au build) donne le domaine principal, ce qui
 * permet un domaine à plus de deux niveaux (`gstock.genius-groups.ci`).
 */
const CENTRAL_DOMAIN = import.meta.env.VITE_CENTRAL_DOMAIN?.trim().toLowerCase()

export function isCentralHost(hostname = window.location.hostname): boolean {
  if (/^[\d.]+$/.test(hostname) || hostname.includes(':')) return true
  if (CENTRAL_DOMAIN && hostname.endsWith(CENTRAL_DOMAIN)) {
    return hostname === CENTRAL_DOMAIN || hostname === `www.${CENTRAL_DOMAIN}`
  }
  const labels = hostname.split('.')
  return labels.length <= (labels.at(-1) === 'localhost' ? 1 : 2)
}
