import { Suspense } from 'react'
import { Outlet } from 'react-router'
import { LoadingState } from '@/components/states'
import { SupportBanner } from '@/features/auth/components/SupportBanner'
import { UserMenu } from '@/features/auth/components/UserMenu'
import { SubscriptionBanner } from '@/features/onboarding/components/SubscriptionBanner'
import { OfflineBanner, OfflineIndicator } from '@/features/sync/components/OfflineIndicator'
import { useAutoSync } from '@/offline/hooks'
import { ShopSwitcher } from '@/features/shops/components/ShopSwitcher'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  // Les opérations faites hors ligne partent toutes seules au retour du réseau (ADR-005).
  useAutoSync()
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[272px_1fr]">
      <Sidebar />
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b-2 border-foreground bg-background px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 lg:hidden">
          <ShopSwitcher className="min-w-0 flex-1" />
          <OfflineIndicator className="max-w-[40vw]" />
          <UserMenu />
        </header>
        <SupportBanner />
        <OfflineBanner />
        <SubscriptionBanner />
        <main className="w-full flex-1 px-4 pt-5 pb-32 lg:px-8 lg:pt-8 lg:pb-12">
          <Suspense fallback={<LoadingState rows={4} />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
