// Référentiels par défaut d'un nouvel espace (§7.3, §8.5, §8.7).
import type { Brand, Category, ExpenseCategory, PaymentMethod, Unit } from '@/types/referentials'

type Seed<T> = Omit<T, 'products_count'>

export const categories: Seed<Category>[] = [
  { id: 1, name: 'Riz et céréales', color: 'peach', is_active: true },
  { id: 2, name: 'Huiles', color: 'yellow', is_active: true },
  { id: 3, name: 'Boissons', color: 'mint', is_active: true },
  { id: 4, name: 'Savons et entretien', color: 'lavender', is_active: true },
  { id: 5, name: 'Sucre et farine', color: 'peach', is_active: true },
]

export const units: Seed<Unit>[] = [
  { id: 1, name: 'Unité', short_name: 'u', base_unit_id: null, operator: null, operator_value: null, is_active: true },
  { id: 2, name: 'Paquet', short_name: 'paq', base_unit_id: null, operator: null, operator_value: null, is_active: true },
  { id: 3, name: 'Carton', short_name: 'ctn', base_unit_id: 1, operator: '*', operator_value: '12', is_active: true },
  { id: 4, name: 'Bouteille', short_name: 'btl', base_unit_id: null, operator: null, operator_value: null, is_active: true },
  { id: 5, name: 'Sachet', short_name: 'sach', base_unit_id: null, operator: null, operator_value: null, is_active: true },
  { id: 6, name: 'Kilogramme', short_name: 'kg', base_unit_id: null, operator: null, operator_value: null, is_active: true },
  { id: 7, name: 'Gramme', short_name: 'g', base_unit_id: 6, operator: '/', operator_value: '1000', is_active: true },
  { id: 8, name: 'Litre', short_name: 'L', base_unit_id: null, operator: null, operator_value: null, is_active: true },
]

export const paymentMethods: PaymentMethod[] = [
  { id: 1, name: 'Espèces', type: 'cash', uses_geniuspay: false, is_active: true },
  { id: 2, name: 'Mobile Money', type: 'mobile_money', uses_geniuspay: true, is_active: true },
  { id: 3, name: 'Carte bancaire', type: 'card', uses_geniuspay: true, is_active: false },
]

export const expenseCategories: ExpenseCategory[] = [
  { id: 1, name: 'Transport', is_active: true },
  { id: 2, name: 'Électricité', is_active: true },
  { id: 3, name: 'Loyer', is_active: true },
  { id: 4, name: 'Internet', is_active: true },
  { id: 5, name: 'Personnel', is_active: true },
  { id: 6, name: 'Autres dépenses', is_active: true },
]

export const brands: Brand[] = [
  { id: 1, name: 'Dinor', is_active: true },
  { id: 2, name: 'Uncle Ben’s', is_active: true },
]
