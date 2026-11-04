// Unités et conversions du serveur (§7.3) : le stock est toujours tenu en unité de base.
import type { ProductUnitOption } from '@/types/catalog'
import type { Unit } from '@/types/referentials'
import { db } from './db'
import { qty } from './stock'

type MockUnit = Omit<Unit, 'products_count'>

/** Nombre d'unités de base dans une unité : Carton = Unité × 12 → 12 ; Gramme = Kilogramme ÷ 1000 → 0,001. */
export function unitFactor(unit: MockUnit): number {
  const value = Number(unit.operator_value)
  if (unit.base_unit_id === null || !(value > 0)) return 1
  return unit.operator === '/' ? 1 / value : value
}

/** Unités utilisables pour un produit : son unité de base, puis ses unités dérivées actives. */
export function unitFamily(baseUnitId: number): MockUnit[] {
  const base = db.units.find((u) => u.id === baseUnitId)
  const derived = db.units.filter((u) => u.base_unit_id === baseUnitId && u.is_active)
  return base ? [base, ...derived] : derived
}

export function unitOption(unit: MockUnit): ProductUnitOption {
  return { id: unit.id, name: unit.name, short_name: unit.short_name, factor: qty(unitFactor(unit)) }
}
