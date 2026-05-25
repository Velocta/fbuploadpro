'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AppSidebar, type DashboardRole } from '@/components/dashboard/app-sidebar'
import { ShellTokenBadge } from '@/components/dashboard/shell-token-badge'
import { LEGACY_COLLAPSED_KEY } from '@/components/dashboard/nav-config'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
interface DashboardShellProps {
  children: React.ReactNode
  user: {
    name: string
    role: string
    tokens_balance: number
    rss_autoposter_enabled: boolean
  }
}

function resolveDashboardRole(pathname: string, profileRole: string): DashboardRole {
  if (pathname.startsWith('/super-admin') || profileRole === 'super_admin') {
    return 'super-admin'
  }
  return 'agency'
}

function roleLabel(role: DashboardRole): string {
  if (role === 'super-admin') return 'Super Admin'
  return 'Agency'
}

function SidebarMobileCloser() {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()

  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }, [pathname, isMobile, setOpenMobile])

  return null
}

function SidebarLegacyMigrator() {
  const { setOpen } = useSidebar()

  useEffect(() => {
    try {
      const legacy = localStorage.getItem(LEGACY_COLLAPSED_KEY)
      if (legacy === '1') {
        setOpen(false)
        localStorage.removeItem(LEGACY_COLLAPSED_KEY)
      }
    } catch {
      /* ignore */
    }
  }, [setOpen])

  return null
}

function DashboardShellInner({
  children,
  user,
}: DashboardShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const role = resolveDashboardRole(pathname, user.role)
  const hasTokens = user.tokens_balance > 0
  const isAgency = role === 'agency'

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.refresh()
    router.push('/login')
  }

  return (
    <>
      <SidebarLegacyMigrator />
      <SidebarMobileCloser />
      <AppSidebar
        role={role}
        hasTokens={hasTokens}
        rssAutoposterEnabled={user.rss_autoposter_enabled}
        userName={user.name}
        userRole={user.role}
        tokensBalance={user.tokens_balance}
        onSignOut={() => void handleSignOut()}
      />
      <SidebarInset className="min-w-0">
        <header className="dashboard-shell-header sticky top-0 z-40 flex h-14 min-w-0 items-center gap-2 overflow-hidden px-4 md:gap-3 md:px-6">
          <SidebarTrigger className="-ml-1 shrink-0" />
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            <span className="truncate font-display text-sm font-bold md:hidden">FBupload Pro</span>
            <span className="hidden truncate text-xs font-medium uppercase tracking-wider text-muted-foreground md:inline">
              {roleLabel(role)}
            </span>
          </div>
          {isAgency ? <ShellTokenBadge tokensBalance={user.tokens_balance} /> : null}
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </SidebarInset>
    </>
  )
}

export function DashboardShell({ children, user }: DashboardShellProps) {
  const [defaultOpen, setDefaultOpen] = useState(true)

  useEffect(() => {
    try {
      const legacy = localStorage.getItem(LEGACY_COLLAPSED_KEY)
      if (legacy === '1') {
        setDefaultOpen(false)
        return
      }
      const match = document.cookie
        .split('; ')
        .find((row) => row.startsWith('sidebar_state='))
      if (match) {
        setDefaultOpen(match.split('=')[1] === 'true')
      }
    } catch {
      /* ignore */
    }
  }, [])

  return (
    <SidebarProvider defaultOpen={defaultOpen} className="min-h-svh">
      <DashboardShellInner user={user}>{children}</DashboardShellInner>
    </SidebarProvider>
  )
}
