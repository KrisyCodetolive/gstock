import { initials } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { User } from '@/types/auth'

export function UserAvatar({ user, className }: { user: User; className?: string }) {
  return (
    <span
      className={cn(
        'grid size-10 shrink-0 place-items-center overflow-hidden rounded-md border-2 border-foreground bg-primary text-sm font-extrabold text-primary-foreground',
        className,
      )}
      aria-hidden="true"
    >
      {user.avatar_url ? <img src={user.avatar_url} alt="" className="size-full object-cover" /> : initials(user.firstname, user.lastname)}
    </span>
  )
}
