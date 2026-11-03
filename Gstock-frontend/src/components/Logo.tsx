import { cn } from '@/lib/utils'

/** Monogramme GStock : bloc indigo avec ombre décalée et « G » mangue. */
export function Logo({ className, withName = true }: { className?: string; withName?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 32 32" className="size-9 shrink-0" aria-hidden="true">
        <rect x="1" y="1" width="27" height="27" rx="6" fill="var(--foreground)" />
        <rect x="4" y="4" width="27" height="27" rx="6" fill="var(--primary)" stroke="var(--foreground)" strokeWidth="2" />
        <path d="M23 13.5a6 6 0 1 0 0 7h-5" fill="none" stroke="var(--action)" strokeWidth="3.2" strokeLinecap="round" />
      </svg>
      {withName && <span className="text-xl font-extrabold tracking-tight">GStock</span>}
    </span>
  )
}
