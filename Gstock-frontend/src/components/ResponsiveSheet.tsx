import type { ReactNode } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useIsDesktop } from '@/lib/use-media-query'

/**
 * Panneau de formulaire : monte du bas sur mobile, s'ouvre à droite sur desktop.
 * Le pied (boutons) reste visible pendant le défilement du contenu.
 */
export function ResponsiveSheet({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  footer?: ReactNode
  children: ReactNode
}) {
  const desktop = useIsDesktop()
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={desktop ? 'right' : 'bottom'}
        className={desktop ? 'gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg' : 'max-h-[92dvh] gap-0'}
      >
        <SheetHeader className="border-b-2 border-muted pr-14">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription className={description ? undefined : 'sr-only'}>{description ?? title}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        {footer && <div className="flex flex-col-reverse gap-3 border-t-2 border-muted p-4 sm:flex-row sm:justify-end">{footer}</div>}
      </SheetContent>
    </Sheet>
  )
}
