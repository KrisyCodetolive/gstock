import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'

/** Retour prévisible vers l'écran parent (MASTER.md, Navigation). */
export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex min-h-11 items-center gap-2 self-start rounded-sm pr-2 text-[15px] font-bold text-primary hover:underline"
    >
      <ArrowLeft className="size-5" strokeWidth={2.4} aria-hidden="true" />
      {label}
    </Link>
  )
}
