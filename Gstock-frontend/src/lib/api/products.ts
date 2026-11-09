// Endpoints du module M06 : produits. Désactivation au lieu de suppression.
import type { Id, ListParams, Paginated, Resource } from '@/types/api'
import type { Product, ProductCreatePayload, ProductPayload, ProductSearchResult, ProductShopStock } from '@/types/catalog'
import { http } from './client'

/** `shopId` : ajoute le stock de cette boutique à chaque produit. */
export function listProducts(params: ListParams & { shopId?: Id } = {}): Promise<Paginated<Product>> {
  const { shopId, ...rest } = params
  return http.get<Paginated<Product>>('/products', { ...rest, shop_id: shopId })
}

export async function getProduct(id: Id, shopId?: Id): Promise<Product> {
  return (await http.get<Resource<Product>>(`/products/${id}`, { shop_id: shopId })).data
}

export async function createProduct(payload: ProductCreatePayload): Promise<Product> {
  return (await http.post<Resource<Product>>('/products', payload)).data
}

export async function updateProduct(id: Id, payload: ProductPayload): Promise<Product> {
  return (await http.put<Resource<Product>>(`/products/${id}`, payload)).data
}

/** Photo du produit, déjà réduite sur l'appareil (champ multipart `image`). */
export async function uploadProductImage(id: Id, file: File): Promise<Product> {
  const form = new FormData()
  form.append('image', file)
  return (await http.upload<Resource<Product>>(`/products/${id}/image`, form)).data
}

export async function deleteProductImage(id: Id): Promise<Product> {
  return (await http.delete<Resource<Product>>(`/products/${id}/image`)).data
}

export async function getProductStock(id: Id): Promise<ProductShopStock[]> {
  return (await http.get<Resource<ProductShopStock[]>>(`/products/${id}/stock`)).data
}

/** Recherche par nom, code ou code-barres, avec le prix et le stock de la boutique. */
export async function searchShopProducts(
  shopId: Id,
  q: string,
  options: { services?: boolean; supplierId?: Id; toRestock?: boolean; signal?: AbortSignal } = {},
): Promise<ProductSearchResult[]> {
  const res = await http.get<Resource<ProductSearchResult[]>>(
    `/shops/${shopId}/products/search`,
    {
      q,
      services: options.services ? 'true' : undefined,
      // Racheter chez un fournisseur : ses articles seulement, au besoin ceux à racheter.
      supplier_id: options.supplierId,
      to_restock: options.toRestock ? 'true' : undefined,
    },
    options.signal,
  )
  return res.data
}
