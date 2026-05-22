'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LogOut,
  BarChart3,
  Building2,
  Menu,
  Coins,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { AgencySidebarNav } from '@/components/dashboard/agency-sidebar-nav'

const SIDEBAR_COLLAPSED_KEY = 'fbuploadpro-sidebar-collapsed'

interface DashboardShellProps {
  children: React.ReactNode
  user: {
    name: string
    role: string
    tokens_balance: number
  }
}

export function DashboardShell({ children, user }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
    } catch {
      return false
    }
  })
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const isSuperAdmin = pathname.startsWith('/super-admin')
  const isAdmin = pathname.startsWith('/admin')
  const isAgency = pathname.startsWith('/agency')
  const hasTokens = user.tokens_balance > 0

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.refresh()
    router.push('/login')
  }

  const superAdminNav = [
    { name: 'Overview', href: '/super-admin', icon: BarChart3 },
    { name: 'Agencies', href: '/super-admin/agencies', icon: Building2 },
  ]

  const adminNav = [
    { name: 'Overview', href: '/admin', icon: BarChart3 },
    { name: 'Agencies', href: '/admin/agencies', icon: Building2 },
  ]

  const sidebarWidth = collapsed ? 'w-[72px]' : 'w-64'

  const renderSimpleNav = (items: { name: string; href: string; icon: React.ComponentType<{ className?: string }> }[]) => (
    <nav className="flex flex-1 flex-col gap-1 p-2">
      {items.map((item) => {
        const Icon = item.icon
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              collapsed && 'justify-center px-2'
            )}
            title={collapsed ? item.name : undefined}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && item.name}
          </Link>
        )
      })}
    </nav>
  )

  const sidebarInner = (
    <>
      <div className={cn('flex h-16 items-center border-b border-sidebar-border px-3', collapsed && 'justify-center')}>
        <Link href={isSuperAdmin ? '/super-admin' : isAgency ? '/agency' : '/admin'} className="flex items-center gap-2">
          <div className="rounded-lg border border-primary/20 bg-primary/10 p-1.5">
            <Image src="/logo.svg" alt="Logo" width={20} height={20} className="h-5 w-5" />
          </div>
          {!collapsed && (
            <p className="font-display text-lg font-black tracking-tighter">
              FBupload <span className="text-primary italic">Pro</span>
            </p>
          )}
        </Link>
      </div>

      {isAgency ? (
        <AgencySidebarNav hasTokens={hasTokens} collapsed={collapsed} />
      ) : isSuperAdmin ? (
        renderSimpleNav(superAdminNav)
      ) : isAdmin ? (
        renderSimpleNav(adminNav)
      ) : null}

      <div className="mt-auto border-t border-sidebar-border p-3 space-y-3">
        {isAgency && !collapsed && (
          <Badge variant="outline" className="w-full justify-center border-primary/20 bg-primary/5 text-primary">
            <Coins className="mr-1.5 h-3.5 w-3.5" />
            {user.tokens_balance.toLocaleString()} tokens
          </Badge>
        )}
        {!collapsed && (
          <div className="px-1">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {user.role?.replace('_', ' ')}
            </p>
          </div>
        )}
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'default'}
          className={cn('text-muted-foreground hover:text-destructive', !collapsed && 'w-full justify-start')}
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Sign out</span>}
        </Button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside
          className={cn(
            'hidden md:flex flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur-md sticky top-0 h-screen shrink-0 transition-all',
            sidebarWidth
          )}
        >
          {sidebarInner}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:inline-flex"
              onClick={toggleCollapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </Button>

            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-[280px] flex-col p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>Navigation</SheetTitle>
                </SheetHeader>
                <div className="flex h-full flex-col">{sidebarInner}</div>
              </SheetContent>
            </Sheet>

            <div className="flex-1 md:hidden font-display font-bold">FBupload Pro</div>

            {isAgency && (
              <Badge variant="outline" className="ml-auto border-primary/20 text-primary md:hidden">
                <Coins className="mr-1 h-3 w-3" />
                {user.tokens_balance}
              </Badge>
            )}
          </header>

          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  )
}
