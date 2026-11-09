import { initials } from '@/lib/format'
import { useImageOk } from '@/lib/use-image-ok'
import { cn } from '@/lib/utils'
import type { User } from '@/types/auth'

export function UserAvatar({ user, className }: { user: User; className?: string }) {
  const image = useImageOk(user.avatar_url)
  return (
    <span
      className={cn(
        'grid size-10 shrink-0 place-items-center overflow-hidden rounded-md border-2 border-foreground bg-primary text-sm font-extrabold text-primary-foreground',
        className,
      )}
      aria-hidden="true"
    >
      {image.ok ? <img src={user.avatar_url!} alt="" onError={image.onError} className="size-full object-cover" /> : initials(user.firstname, user.lastname)}
    </span>
  )
}
