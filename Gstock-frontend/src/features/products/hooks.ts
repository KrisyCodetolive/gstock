import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createProduct, getProduct, getProductStock, listProducts, searchShopProducts, updateProduct } from '@/lib/api/products'
import type { Id, ListParams } from '@/types/api'
import type { ProductCreatePayload, ProductPayload } from '@/types/catalog'

const productsKey = ['products'] as const

export function useProducts(params: ListParams, shopId?: Id) {
  return useQuery({
    queryKey: [...productsKey, 'list', shopId, params],
    queryFn: () => listProducts({ ...params, shopId }),
    placeholderData: keepPreviousData,
  })
}

export function useProduct(id: Id | undefined, shopId?: Id) {
  return useQuery({
    queryKey: [...productsKey, 'detail', id, shopId],
    queryFn: () => getProduct(id!, shopId),
    enabled: id !== undefined,
  })
}

export function useProductStock(id: Id | undefined, enabled = true) {
  return useQuery({
    queryKey: [...productsKey, 'stock', id],
    queryFn: () => getProductStock(id!),
    enabled: enabled && id !== undefined,
  })
}

/** Recherche pour les sélecteurs ; vide = pas de requête. */
export function useProductSearch(shopId: Id | undefined, q: string, options: { services?: boolean } = {}) {
  return useQuery({
    queryKey: [...productsKey, 'search', shopId, q, options.services],
    queryFn: ({ signal }) => searchShopProducts(shopId!, q, { ...options, signal }),
    enabled: shopId !== undefined,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  })
}

export function useSaveProduct(id?: Id) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: ProductCreatePayload | ProductPayload) =>
      id === undefined ? createProduct(payload) : updateProduct(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: productsKey })
      // Le stock (quantité initiale) et les compteurs des référentiels changent aussi.
      void queryClient.invalidateQueries({ queryKey: ['stock'] })
      void queryClient.invalidateQueries({ queryKey: ['referentials'] })
    },
  })
}
