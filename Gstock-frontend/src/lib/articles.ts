// Un « article » est ce que l'on vend, achète ou compte : un produit simple, ou une
// variante d'un produit à variantes. Sa clé sert à le retrouver dans un panier ou une liste.
import type { Id } from '@/types/api'

export const articleKey = (productId: Id, variantId?: Id | null) => (variantId ? `${productId}:${variantId}` : String(productId))
