import type { ReactNode } from 'react'
import { useCan } from '@/features/auth/hooks'
import type { Permission } from '@/types/auth'
import { ForbiddenPage } from './pages/StatusPages'

/** Page refusée : « Vous n'avez pas accès à cette page » (§6.2). */
export function RequirePermission({
  permissions,
  children,
}: {
  permissions?: readonly Permission[]
  children: ReactNode
}) {
  const can = useCan()
  if (permissions && !can(permissions)) return <ForbiddenPage />
  return children
}
