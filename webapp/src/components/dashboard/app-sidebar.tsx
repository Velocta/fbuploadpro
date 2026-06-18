'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { PanelLeftClose } from 'lucide-react'

import {
  agencyDashboardItem,
  agencyNavGroups,
  STORAGE_GROUPS_KEY,
  superAdminNavItems,
} from '@/components/dashboard/nav-config'
import { NavUser } from '@/components/dashboard/nav-user'
import { SidebarBrand } from '@/components/dashboard/sidebar-brand'
import { SidebarFlatNavItem } from '@/components/dashboard/sidebar-nav-item'
import { SidebarPlatformGroups } from '@/components/dashboard/sidebar-platform-group'
import { sidebarMenuButtonActiveClass } from '@/components/dashboard/sidebar-styles'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { filterAgencyNavGroups } from '@/lib/filter-agency-nav'
import { findActiveGroupId, isNavActive } from '@/lib/nav-active'

export type DashboardRole = 'agency' | 'super-admin'

type AppSidebarProps = {
  role: DashboardRole
  hasTokens: boolean
  rssAutoposterEnabled?: boolean
  userName: string
  userRole: string
  tokensBalance: number
  onSignOut: () => void
}

const DEFAULT_OPEN_GROUPS: Record<string, boolean> = {
  facebook: true,
  youtube: false,
  instagram: false,
  settings: true,
}

function AgencySidebarContent({
  hasTokens,
  rssAutoposterEnabled,
}: {
  hasTokens: boolean
  rssAutoposterEnabled: boolean
}) {
  const pathname = usePathname()
  const { state, isMobile } = useSidebar()
  const iconCollapsed = state === 'collapsed' && !isMobile
  const [openGroups, setOpenGroups] = useState(DEFAULT_OPEN_GROUPS)
  const navGroups = useMemo(
    () => filterAgencyNavGroups(agencyNavGroups, { rssAutoposterEnabled }),
    [rssAutoposterEnabled]
  )

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_GROUPS_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        const t = setTimeout(() => {
          setOpenGroups((prev) => ({ ...prev, ...parsed }))
        }, 0)
        return () => clearTimeout(t)
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    const activeGroupId = findActiveGroupId(pathname, navGroups)
    if (!activeGroupId) return
    const t = setTimeout(() => {
      setOpenGroups((prev) => {
        if (prev[activeGroupId]) return prev
        const next = { ...prev, [activeGroupId]: true }
        try {
          localStorage.setItem(STORAGE_GROUPS_KEY, JSON.stringify(next))
        } catch {
          /* ignore */
        }
        return next
      })
    }, 0)
    return () => clearTimeout(t)
  }, [pathname, navGroups])

  const setGroupOpen = (id: string, open: boolean) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [id]: open }
      try {
        localStorage.setItem(STORAGE_GROUPS_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const DashboardIcon = agencyDashboardItem.icon

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip={agencyDashboardItem.title}
                isActive={isNavActive(pathname, agencyDashboardItem.href)}
                className={sidebarMenuButtonActiveClass}
              >
                <Link href={agencyDashboardItem.href}>
                  <DashboardIcon />
                  <span>{agencyDashboardItem.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarPlatformGroups
        groups={navGroups}
        hasTokens={hasTokens}
        iconCollapsed={iconCollapsed}
        openGroups={openGroups}
        onGroupOpenChange={setGroupOpen}
      />
    </>
  )
}

function SidebarMobileClose() {
  const { isMobile, setOpenMobile } = useSidebar()

  if (!isMobile) {
    return null
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-8 shrink-0"
      onClick={() => setOpenMobile(false)}
      aria-label="Close menu"
    >
      <PanelLeftClose className="size-5" />
    </Button>
  )
}

function FlatSidebarNav({ items }: { items: typeof superAdminNavItems }) {
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarFlatNavItem
              key={item.href}
              title={item.title}
              href={item.href}
              icon={item.icon}
              hasTokens
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

export function AppSidebar({
  role,
  hasTokens,
  rssAutoposterEnabled = false,
  userName,
  userRole,
  tokensBalance,
  onSignOut,
}: AppSidebarProps) {
  const homeHref = useMemo(() => {
    if (role === 'super-admin') return '/super-admin'
    return '/agency'
  }, [role])

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="border-b border-sidebar-border/50 bg-sidebar/40">
        <SidebarBrand homeHref={homeHref} trailing={<SidebarMobileClose />} />
      </SidebarHeader>

      <SidebarContent className="bg-transparent">
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-2 p-2">
            {role === 'agency' ? (
              <AgencySidebarContent
                hasTokens={hasTokens}
                rssAutoposterEnabled={rssAutoposterEnabled}
              />
            ) : (
              <FlatSidebarNav items={superAdminNavItems} />
            )}
          </div>
        </ScrollArea>
      </SidebarContent>

      <NavUser
        name={userName}
        role={userRole}
        tokensBalance={tokensBalance}
        showTokens={role === 'agency'}
        onSignOut={onSignOut}
      />
    </Sidebar>
  )
}
