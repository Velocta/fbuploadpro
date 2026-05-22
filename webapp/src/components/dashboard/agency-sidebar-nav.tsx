'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Building2,
  ChevronDown,
  Download,
  Facebook,
  Instagram,
  Lock,
  MessageSquare,
  Settings,
  Trash2,
  Youtube,
  Calendar,
  CalendarClock,
  Send,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

type NavLink = {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  requiresTokens?: boolean
}

type NavGroup = {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  items: NavLink[]
  requiresTokens?: boolean
  shellOnly?: boolean
}

const STORAGE_OPEN_KEY = 'fbuploadpro-sidebar-groups'

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AgencySidebarNav({
  hasTokens,
  collapsed,
}: {
  hasTokens: boolean
  collapsed: boolean
}) {
  const pathname = usePathname()
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const defaults = {
      facebook: true,
      youtube: false,
      instagram: false,
      settings: true,
    }
    if (typeof window === 'undefined') return defaults
    try {
      const raw = localStorage.getItem(STORAGE_OPEN_KEY)
      if (raw) return { ...defaults, ...JSON.parse(raw) }
    } catch {
      /* ignore */
    }
    return defaults
  })

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      try {
        localStorage.setItem(STORAGE_OPEN_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const groups: NavGroup[] = [
    {
      id: 'facebook',
      label: 'Facebook',
      icon: Facebook,
      requiresTokens: true,
      items: [
        { name: 'Accounts', href: '/agency/facebook/accounts', icon: Building2, requiresTokens: true },
        { name: 'Auto Download/Upload', href: '/agency/facebook/auto-download-upload', icon: Download, requiresTokens: true },
        { name: 'Bulk Delete Posts', href: '/agency/facebook/bulk-delete', icon: Trash2, requiresTokens: true },
        { name: 'Direct Post', href: '/agency/facebook/direct-post', icon: Send, requiresTokens: true },
        { name: 'Direct Schedule', href: '/agency/facebook/direct-schedule', icon: Calendar, requiresTokens: true },
        { name: 'InApp Schedule', href: '/agency/facebook/inapp-schedule', icon: CalendarClock, requiresTokens: true },
      ],
    },
    {
      id: 'youtube',
      label: 'YouTube',
      icon: Youtube,
      shellOnly: true,
      items: [
        { name: 'Accounts', href: '/agency/youtube/accounts', icon: Building2 },
        { name: 'Direct Post', href: '/agency/youtube/direct-post', icon: Send },
        { name: 'Direct Schedule', href: '/agency/youtube/direct-schedule', icon: Calendar },
        { name: 'InApp Schedule', href: '/agency/youtube/inapp-schedule', icon: CalendarClock },
      ],
    },
    {
      id: 'instagram',
      label: 'Instagram',
      icon: Instagram,
      shellOnly: true,
      items: [
        { name: 'Accounts', href: '/agency/instagram/accounts', icon: Building2 },
        { name: 'Direct Post', href: '/agency/instagram/direct-post', icon: Send },
        { name: 'Direct Schedule', href: '/agency/instagram/direct-schedule', icon: Calendar },
        { name: 'InApp Schedule', href: '/agency/instagram/inapp-schedule', icon: CalendarClock },
      ],
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      items: [
        { name: 'Facebook BYOC', href: '/agency/settings/facebook-byoc', icon: Facebook },
        { name: 'YouTube BYOC', href: '/agency/settings/youtube-byoc', icon: Youtube },
        { name: 'Instagram BYOC', href: '/agency/settings/instagram-byoc', icon: Instagram },
      ],
    },
  ]

  const dashboardLink: NavLink = {
    name: 'Dashboard',
    href: '/agency',
    icon: BarChart3,
  }

  const renderLink = (item: NavLink) => {
    const locked = item.requiresTokens && !hasTokens
    const active = isActive(pathname, item.href)
    const Icon = item.icon

    return (
      <Link
        key={item.href}
        href={locked ? '/agency?addTokens=1' : item.href}
        aria-disabled={locked}
        className={cn(
          'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          active
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          locked && 'opacity-60',
          collapsed && 'justify-center px-2'
        )}
        title={collapsed ? item.name : undefined}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="truncate">{item.name}</span>}
        {!collapsed && locked ? <Lock className="ml-auto h-3.5 w-3.5" /> : null}
      </Link>
    )
  }

  return (
    <nav className="flex flex-1 flex-col gap-1 p-2">
      {renderLink(dashboardLink)}

      {groups.map((group) => {
        const GroupIcon = group.icon
        const groupLocked = group.requiresTokens && !hasTokens
        const open = openGroups[group.id] ?? false

        return (
          <div key={group.id} className="mt-1">
            <button
              type="button"
              onClick={() => toggleGroup(group.id)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-foreground hover:bg-accent',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? group.label : undefined}
            >
              <GroupIcon className="h-4 w-4 shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left">{group.label}</span>
                  {groupLocked ? <Lock className="h-3.5 w-3.5 text-muted-foreground" /> : null}
                  {group.shellOnly && !collapsed ? (
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Soon</span>
                  ) : null}
                  <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
                </>
              )}
            </button>
            {!collapsed && open ? (
              <div className="ml-2 mt-1 flex flex-col gap-0.5 border-l border-border pl-2">
                {group.items.map((item) => renderLink(item))}
              </div>
            ) : null}
          </div>
        )
      })}

      {!collapsed ? (
        <p className="mt-4 flex items-center gap-2 px-3 text-xs text-muted-foreground">
          <MessageSquare className="h-3.5 w-3.5" />
          Dashboard analytics coming soon
        </p>
      ) : null}
    </nav>
  )
}
