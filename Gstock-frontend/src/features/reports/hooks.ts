import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getCustomersReport, getProductsReport, getSalesReport } from '@/lib/api/reports'
import type { Id } from '@/types/api'
import type { DormantDays, LostDays, ReportQuery } from '@/types/reports'

/** `shopId` null : toutes les boutiques (propriétaire) ; undefined : pas encore de boutique. */
export function useSalesReport(shopId: Id | null | undefined, query: ReportQuery) {
  return useQuery({
    queryKey: ['reports', 'sales', shopId, query],
    queryFn: () => getSalesReport(shopId ?? null, query),
    enabled: shopId !== undefined,
    placeholderData: keepPreviousData,
  })
}

export function useProductsReport(shopId: Id | null | undefined, query: ReportQuery, dormantDays: DormantDays) {
  return useQuery({
    queryKey: ['reports', 'products', shopId, query, dormantDays],
    queryFn: () => getProductsReport(shopId ?? null, { ...query, dormant_days: dormantDays }),
    enabled: shopId !== undefined,
    placeholderData: keepPreviousData,
  })
}

export function useCustomersReport(shopId: Id | null | undefined, query: ReportQuery, lostDays: LostDays) {
  return useQuery({
    queryKey: ['reports', 'customers', shopId, query, lostDays],
    queryFn: () => getCustomersReport(shopId ?? null, { ...query, lost_days: lostDays }),
    enabled: shopId !== undefined,
    placeholderData: keepPreviousData,
  })
}
