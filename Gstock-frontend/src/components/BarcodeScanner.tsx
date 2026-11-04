import { CameraOff, ScanBarcode } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ResponsiveSheet } from '@/components/ResponsiveSheet'
import { Button } from '@/components/ui/button'
import { cameraAvailable, getBarcodeDetector } from '@/lib/barcode'
import i18n from '@/lib/i18n'
import { cn } from '@/lib/utils'

type Status = 'starting' | 'scanning' | 'denied' | 'no_camera' | 'error'

/**
 * Lecture d'un code-barres avec la caméra arrière : dès qu'un code est lu,
 * le téléphone vibre, la caméra s'éteint et `onDetected` reçoit le code.
 */
export function BarcodeScanner({
  open,
  onOpenChange,
  onDetected,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDetected: (code: string) => void
}) {
  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={i18n.t('common.scan.title')} description={i18n.t('common.scan.text')}>
      {open && (
        <CameraView
          onDetected={(code) => {
            onOpenChange(false)
            onDetected(code)
          }}
        />
      )}
    </ResponsiveSheet>
  )
}

function CameraView({ onDetected }: { onDetected: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<Status>('starting')
  const done = useRef(onDetected)
  useEffect(() => {
    done.current = onDetected
  })

  useEffect(() => {
    let stream: MediaStream | undefined
    let frame = 0
    let stopped = false
    let last = 0

    const stop = () => {
      stopped = true
      cancelAnimationFrame(frame)
      stream?.getTracks().forEach((t) => t.stop())
    }

    void (async () => {
      try {
        const [media, detector] = await Promise.all([
          navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }),
          getBarcodeDetector(),
        ])
        stream = media
        if (stopped || !video.current) return stop()
        video.current.srcObject = media
        await video.current.play()
        setStatus('scanning')

        // Une lecture toutes les 150 ms suffit et ménage la batterie.
        const tick = async (time: number) => {
          if (stopped || !video.current) return
          if (time - last > 150 && video.current.readyState >= 2) {
            last = time
            const codes = await detector.detect(video.current).catch(() => [])
            const code = codes.find((c) => c.rawValue.trim())?.rawValue.trim()
            if (code && !stopped) {
              navigator.vibrate?.(80)
              stop()
              done.current(code)
              return
            }
          }
          frame = requestAnimationFrame((t) => void tick(t))
        }
        frame = requestAnimationFrame((t) => void tick(t))
      } catch (error) {
        if (stopped) return
        const name = error instanceof DOMException ? error.name : ''
        setStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'no_camera' : 'error')
        stop()
      }
    })()

    return stop
  }, [])

  if (status === 'denied' || status === 'no_camera' || status === 'error') {
    return (
      <div className="grid justify-items-center gap-3 py-8 text-center" role="alert">
        <span className="grid size-16 place-items-center rounded-lg border-2 border-foreground bg-destructive-bg text-destructive">
          <CameraOff className="size-8" aria-hidden="true" />
        </span>
        <p className="font-semibold">{i18n.t(`common.scan.${status}`)}</p>
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      <div className="relative aspect-square overflow-hidden rounded-lg border-2 border-foreground bg-foreground">
        <video ref={video} className="size-full object-cover" muted playsInline aria-label={i18n.t('common.scan.title')} />
        {/* Cadre de visée */}
        <span className="pointer-events-none absolute inset-x-[12%] top-[30%] bottom-[30%] rounded-md border-4 border-action shadow-[0_0_0_999px_rgb(0_0_0/0.35)]" aria-hidden="true" />
      </div>
      <p className={cn('text-center text-sm font-semibold', status === 'starting' && 'animate-pulse')} role="status">
        {status === 'starting' ? i18n.t('common.scan.starting') : i18n.t('common.scan.aim')}
      </p>
    </div>
  )
}

/** Bouton « Scanner » : absent si la caméra n'est pas utilisable sur cet appareil. */
export function ScanButton({ onDetected, className, label }: { onDetected: (code: string) => void; className?: string; label?: string }) {
  const [open, setOpen] = useState(false)
  if (!cameraAvailable()) return null
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={label ? 'default' : 'icon'}
        className={cn('h-12 shrink-0', !label && 'w-12', className)}
        onClick={() => setOpen(true)}
        aria-label={label ? undefined : i18n.t('common.scan.button')}
      >
        <ScanBarcode aria-hidden="true" />
        {label}
      </Button>
      <BarcodeScanner open={open} onOpenChange={setOpen} onDetected={onDetected} />
    </>
  )
}
