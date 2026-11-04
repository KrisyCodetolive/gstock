import { Camera, Trash2 } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { FieldError } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api/client'
import i18n from '@/lib/i18n'
import { ImageError, IMAGE_TYPES, prepareImage } from '@/lib/image'
import { cn } from '@/lib/utils'

/**
 * Choix d'une photo (galerie ou appareil photo) : aperçu, « Changer », « Retirer ».
 * La photo est réduite sur l'appareil avant d'être passée à `onPick`.
 */
export function PhotoPicker({
  id,
  imageUrl,
  fallback,
  onPick,
  onRemove,
  pending,
  disabled,
  maxSize,
  className,
}: {
  id: string
  imageUrl: string | null
  /** Ce qui s'affiche sans photo (initiales, vignette de catégorie…). */
  fallback: ReactNode
  onPick: (file: File) => Promise<unknown>
  onRemove?: () => Promise<unknown>
  pending?: boolean
  disabled?: boolean
  maxSize?: number
  className?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async (action: () => Promise<unknown>) => {
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(e instanceof ImageError || e instanceof ApiError ? e.message : i18n.t('common.generic_error'))
    }
  }

  const pick = (file: File | undefined) => {
    if (input.current) input.current.value = ''
    if (file) void run(async () => onPick(await prepareImage(file, maxSize)))
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-4', className)}>
      <span className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-lg border-2 border-foreground bg-muted">
        {imageUrl ? <img src={imageUrl} alt="" className="size-full object-cover" /> : fallback}
      </span>
      <div className="grid gap-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={pending || disabled} onClick={() => input.current?.click()}>
            <Camera aria-hidden="true" />
            {imageUrl ? i18n.t('common.photo.change') : i18n.t('common.photo.add')}
          </Button>
          {imageUrl && onRemove && (
            <Button type="button" variant="ghost" disabled={pending || disabled} onClick={() => void run(onRemove)}>
              <Trash2 aria-hidden="true" />
              {i18n.t('common.photo.remove')}
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{pending ? i18n.t('common.photo.sending') : i18n.t('common.photo.hint')}</p>
        {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
      </div>
      <input
        ref={input}
        id={id}
        type="file"
        accept={IMAGE_TYPES.join(',')}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => pick(e.target.files?.[0])}
      />
    </div>
  )
}
