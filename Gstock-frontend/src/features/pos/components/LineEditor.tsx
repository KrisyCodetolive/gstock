import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FormField } from '@/components/FormField'
import { Money } from '@/components/Money'
import { ResponsiveSheet } from '@/components/ResponsiveSheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCan } from '@/features/auth/hooks'
import { articleKey } from '@/lib/articles'
import { cn } from '@/lib/utils'
import type { Id } from '@/types/api'
import type { DiscountMethod } from '@/types/sales'
import { usePosStore, type CartLine } from '../store'
import type { PosProduct } from './ProductGrid'

/** Prix et remise d'une ligne, selon les permissions (sales.edit_price, sales.give_discount). */
export function LineEditor({ shopId, product, line, onClose }: { shopId: Id; product: PosProduct; line: CartLine; onClose: () => void }) {
  const { t } = useTranslation()
  const can = useCan()
  const update = usePosStore((s) => s.updateLine)
  const [price, setPrice] = useState(line.price ?? String(Number(product.price)))
  const [discount, setDiscount] = useState(line.discount ?? '')
  const [method, setMethod] = useState<DiscountMethod>(line.discountMethod ?? 'fixed')
  const canPrice = can('sales.edit_price')
  const canDiscount = can('sales.give_discount')

  const save = () => {
    update(shopId, articleKey(product.id, product.variant_id), {
      price: canPrice && price !== String(Number(product.price)) ? price.replace(',', '.') : undefined,
      discount: canDiscount && discount ? discount.replace(',', '.') : undefined,
      discountMethod: canDiscount && discount ? method : undefined,
    })
    onClose()
  }

  return (
    <ResponsiveSheet open onOpenChange={(o) => !o && onClose()} title={product.name} description={t('sales.pos.edit_line', { name: product.name })}>
      <div className="grid gap-5">
        <p className="text-sm text-muted-foreground">
          {t('sales.pos.price')} : <Money value={product.price} className="text-foreground" />
        </p>
        {canPrice && (
          <FormField id="line-price" label={`${t('sales.pos.price')} (FCFA)`}>
            <Input inputMode="numeric" className="tabular" value={price} onChange={(e) => setPrice(e.target.value)} />
          </FormField>
        )}
        {canDiscount && (
          <div className="grid gap-2">
            <FormField id="line-discount" label={t('sales.pos.discount_line', { name: product.name })}>
              <Input inputMode="decimal" className="tabular" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </FormField>
            <div className="inline-flex justify-self-start rounded-md border-2 border-foreground bg-card p-1" role="group" aria-label={t('sales.pos.discount')}>
              {(['fixed', 'percent'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={method === m}
                  onClick={() => setMethod(m)}
                  className={cn('min-h-10 rounded-sm px-4 text-sm font-bold', method === m ? 'bg-foreground text-background' : 'hover:bg-muted')}
                >
                  {m === 'fixed' ? t('sales.pos.discount_fixed') : t('sales.pos.discount_percent')}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-[auto_1fr] gap-3">
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={save} disabled={!canPrice && !canDiscount}>
            {t('common.save')}
          </Button>
        </div>
      </div>
    </ResponsiveSheet>
  )
}
