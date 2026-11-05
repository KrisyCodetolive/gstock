import { ChevronRight, Truck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useCan } from '@/features/auth/hooks'
import { useCurrentShop } from '@/features/shops/hooks'
import { useTransfers } from '../hooks'

/** Rappel dans la boutique d'arrivée tant qu'un transfert est en route vers elle (§7.12). */
export function TransfersToReceive() {
  const { t } = useTranslation()
  const can = useCan()
  const { shop } = useCurrentShop()
  const transfers = useTransfers(shop?.id, { direction: 'in', per_page: 1, filter: { status: 'in_transit' } }, can('stock.view'))
  const count = transfers.data?.summary.to_receive ?? 0
  if (!shop || count === 0) return null

  return (
    <Link to="/stock/transferts?status=in_transit" className="pressable flex min-h-14 items-center gap-3 rounded-md bg-warn-bg px-4 py-3">
      <Truck className="size-6 shrink-0 text-warn" aria-hidden="true" />
      <span className="grid min-w-0 flex-1">
        <span className="font-bold">{t('stock.transfers.to_receive', { count })}</span>
        <span className="text-sm text-muted-foreground">{t('stock.transfers.to_receive_hint', { shop: shop.name })}</span>
      </span>
      <ChevronRight className="size-5 shrink-0" aria-hidden="true" />
    </Link>
  )
}
