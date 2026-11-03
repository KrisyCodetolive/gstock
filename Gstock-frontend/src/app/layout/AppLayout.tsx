import { Outlet } from 'react-router'
import { UserMenu } from '@/features/auth/components/UserMenu'
import { ShopSwitcher } from '@/features/shops/components/ShopSwitcher'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[272px_1fr]">
      <Sidebar />
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b-2 border-foreground bg-background px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 lg:hidden">
          <ShopSwitcher className="max-w-[70vw]" />
          <UserMenu />
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-32 lg:px-8 lg:pt-8 lg:pb-12">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
