import { LogOut, Store } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation } from 'react-router'
import { Logo } from '@/components/Logo'
import { ErrorState, MessageBlock } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useLogout, useMe } from '../hooks'

/** Écran affiché pendant le chargement de la session. */
export function SplashScreen() {
  const { t } = useTranslation()
  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-label={t('states.loading')}>
      <Logo className="animate-pulse" />
    </div>
  )
}

/** Protège les routes : sans session, on renvoie vers la connexion. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const location = useLocation()
  const me = useMe()
  const logout = useLogout()

  if (me.isPending) return <SplashScreen />
  if (me.isError) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <ErrorState error={me.error} onRetry={() => void me.refetch()} />
      </div>
    )
  }
  if (!me.data) return <Navigate to="/connexion" replace state={{ from: location.pathname }} />

  // Sans affectation, un collaborateur n'a accès à aucune boutique (§6.2).
  if (me.data.shops.length === 0) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <MessageBlock
          icon={Store}
          title={t('shop.none_title')}
          text={t('shop.none_text')}
          action={
            <Button variant="outline" onClick={() => logout.mutate()}>
              <LogOut aria-hidden="true" />
              {t('user.logout')}
            </Button>
          }
        />
      </div>
    )
  }

  return children
}
