// Espace de démonstration (cahier §11.3) : un commerçant, deux boutiques.
import type { ShopSummary, TenantSummary } from '@/types/auth'

export const tenant: TenantSummary = {
  name: 'Alimentation Koné',
  currency: 'XOF',
  timezone: 'Africa/Abidjan',
}

export const shops: ShopSummary[] = [
  { id: 1, name: 'Boutique Cocody', city: 'Abidjan', district: 'Angré' },
  { id: 2, name: 'Boutique Yopougon', city: 'Abidjan', district: 'Siporex' },
]
