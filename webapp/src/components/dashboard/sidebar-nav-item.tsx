'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Lock } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { ADD_TOKENS_HREF } from '@/components/dashboard/nav-config'
import {
  sidebarMenuButtonActiveClass,
  sidebarSubButtonActiveClass,
} from '@/components/dashboard/sidebar-styles'
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar'
import { isNavActive } from '@/lib/nav-active'
import { cn } from '@/lib/utils'

type SidebarNavItemProps = {
  title: string
  href: string
  icon: LucideIcon
  requiresTokens?: boolean
  hasTokens: boolean
  tooltip?: string
}

export function SidebarFlatNavItem({
  title,
  href,
  icon: Icon,
  requiresTokens,
  hasTokens,
  tooltip,
}: SidebarNavItemProps) {
  const pathname = usePathname()
  const locked = Boolean(requiresTokens && !hasTokens)
  const active = isNavActive(pathname, href)

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        tooltip={tooltip ?? title}
        isActive={active}
        className={cn(sidebarMenuButtonActiveClass, locked && 'opacity-60')}
      >
        <Link
          href={locked ? ADD_TOKENS_HREF : href}
          aria-disabled={locked}
          title={locked ? 'Add tokens to unlock' : undefined}
        >
          <Icon />
          <span>{title}</span>
          {locked ? <Lock className="ml-auto size-3.5 shrink-0" /> : null}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export function SidebarSubNavItem({
  title,
  href,
  icon: Icon,
  requiresTokens,
  hasTokens,
}: SidebarNavItemProps) {
  const pathname = usePathname()
  const locked = Boolean(requiresTokens && !hasTokens)
  const active = isNavActive(pathname, href)

  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton
        asChild
        isActive={active}
        className={cn(sidebarSubButtonActiveClass, locked && 'opacity-60')}
      >
        <Link
          href={locked ? ADD_TOKENS_HREF : href}
          aria-disabled={locked}
          title={locked ? 'Add tokens to unlock' : undefined}
        >
          <Icon />
          <span>{title}</span>
          {locked ? <Lock className="ml-auto size-3.5 shrink-0" /> : null}
        </Link>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )
}
