import { Package, Truck } from 'lucide-react'
import { useImageOk } from '@/lib/use-image-ok'
import { cn } from '@/lib/utils'
import type { CategoryColor } from '@/types/referentials'
import type { ProductType } from '@/types/catalog'

const TINT: Record<CategoryColor, string> = {
  peach: 'bg-tint-peach',
  yellow: 'bg-tint-yellow',
  mint: 'bg-tint-mint',
  lavender: 'bg-tint-lavender',
}

/**
 * Vignette d'un produit : sa photo, sinon l'initiale sur la teinte de sa catégorie
 * (une teinte par catégorie, MASTER.md).
 */
export function ProductThumb({
  name,
  color,
  imageUrl,
  type = 'simple',
  className,
}: {
  name: string
  color?: CategoryColor | null
  imageUrl?: string | null
  type?: ProductType
  className?: string
}) {
  const image = useImageOk(imageUrl)
  const base = cn('grid size-12 shrink-0 place-items-center overflow-hidden rounded-sm border-2 border-foreground', TINT[color ?? 'lavender'], className)
  // `className` peut demander `object-contain` (image entière sur la teinte de la catégorie).
  if (image.ok) return <img src={imageUrl!} alt="" onError={image.onError} className={cn('object-cover', base)} />
  if (type === 'service') {
    return (
      <span className={base} aria-hidden="true">
        <Truck className="size-6" />
      </span>
    )
  }
  const letter = name.trim().charAt(0).toUpperCase()
  return (
    <span className={cn(base, 'text-lg font-extrabold')} aria-hidden="true">
      {letter || <Package className="size-6" />}
    </span>
  )
}
