'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Lock } from 'lucide-react'

import {
  ADD_TOKENS_HREF,
  type NavGroupConfig,
  type NavItemConfig,
} from '@/components/dashboard/nav-config'
import { SidebarSubNavItem } from '@/components/dashboard/sidebar-nav-item'
import {
  platformIconClass,
  sidebarDropdownLinkActiveClass,
  sidebarMenuButtonActiveClass,
} from '@/components/dashboard/sidebar-styles'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
} from '@/components/ui/sidebar'
import { isNavActive } from '@/lib/nav-active'
import { cn } from '@/lib/utils'

function NavSoonBadge() {
  return <SidebarMenuBadge className="uppercase">Soon</SidebarMenuBadge>
}

export function SidebarPlatformGroupCollapsed({
  group,
  hasTokens,
}: {
  group: NavGroupConfig
  hasTokens: boolean
}) {
  const pathname = usePathname()
  const groupLocked = Boolean(group.requiresTokens && !hasTokens)
  const GroupIcon = group.icon
  const groupHasActiveChild = group.items.some((item) => isNavActive(pathname, item.href))

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            tooltip={group.title}
            isActive={groupHasActiveChild}
            className={cn(sidebarMenuButtonActiveClass, platformIconClass(group.id), '[&>svg:first-child]:shrink-0')}
          >
            <GroupIcon />
            <span>{group.title}</span>
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="dashboard-sidebar-popover">
          <DropdownMenuLabel className="flex items-center gap-2">
            {group.title}
            {group.badge === 'soon' ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                Soon
              </span>
            ) : null}
          </DropdownMenuLabel>
          {groupLocked ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={ADD_TOKENS_HREF} className="gap-2">
                  <Lock className="size-4" />
                  Add tokens to unlock
                </Link>
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuSeparator />
              {group.items.map((item) => (
                <SidebarPlatformDropdownItem
                  key={item.href}
                  item={item}
                  hasTokens={hasTokens}
                />
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}

function SidebarPlatformDropdownItem({
  item,
  hasTokens,
}: {
  item: NavItemConfig
  hasTokens: boolean
}) {
  const pathname = usePathname()
  const locked = Boolean(item.requiresTokens && !hasTokens)
  const ItemIcon = item.icon
  const active = isNavActive(pathname, item.href)

  return (
    <DropdownMenuItem asChild>
      <Link
        href={locked ? ADD_TOKENS_HREF : item.href}
        className={cn('gap-2', active && sidebarDropdownLinkActiveClass)}
      >
        <ItemIcon className="size-4" />
        {item.title}
        {locked ? <Lock className="ml-auto size-3.5" /> : null}
      </Link>
    </DropdownMenuItem>
  )
}

export function SidebarPlatformGroupExpanded({
  group,
  hasTokens,
  open,
  onOpenChange,
}: {
  group: NavGroupConfig
  hasTokens: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const groupLocked = Boolean(group.requiresTokens && !hasTokens)
  const GroupIcon = group.icon

  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="group/collapsible">
      <SidebarGroup className="py-0">
        <SidebarGroupLabel
          asChild
          className="group/label rounded-md px-2 text-sm font-semibold text-sidebar-foreground hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground"
        >
          <CollapsibleTrigger className="flex w-full items-center gap-2">
            <GroupIcon className={cn('size-4', group.id === 'facebook' && 'text-blue-500')} />
            <span className="flex-1 text-left">{group.title}</span>
            {groupLocked ? <Lock className="size-3.5 text-muted-foreground" /> : null}
            {group.badge === 'soon' ? <NavSoonBadge /> : null}
            <ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarGroupContent className="pt-0">
            <SidebarMenuSub>
              {group.items.map((item) => (
                <SidebarSubNavItem
                  key={item.href}
                  title={item.title}
                  href={item.href}
                  icon={item.icon}
                  requiresTokens={item.requiresTokens}
                  hasTokens={hasTokens}
                />
              ))}
            </SidebarMenuSub>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  )
}

export function SidebarPlatformGroups({
  groups,
  hasTokens,
  iconCollapsed,
  openGroups,
  onGroupOpenChange,
}: {
  groups: NavGroupConfig[]
  hasTokens: boolean
  iconCollapsed: boolean
  openGroups: Record<string, boolean>
  onGroupOpenChange: (id: string, open: boolean) => void
}) {
  if (iconCollapsed) {
    return (
      <SidebarGroup>
        <SidebarGroupLabel className="dashboard-sidebar-section-label">Platform</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {groups.map((group) => (
              <SidebarPlatformGroupCollapsed key={group.id} group={group} hasTokens={hasTokens} />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    )
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="dashboard-sidebar-section-label">Platform</SidebarGroupLabel>
      {groups.map((group) => (
        <SidebarPlatformGroupExpanded
          key={group.id}
          group={group}
          hasTokens={hasTokens}
          open={openGroups[group.id] ?? false}
          onOpenChange={(open) => onGroupOpenChange(group.id, open)}
        />
      ))}
    </SidebarGroup>
  )
}
