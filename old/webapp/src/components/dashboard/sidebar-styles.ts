import { cn } from '@/lib/utils'

export function platformIconClass(groupId: string) {
  return cn(groupId === 'facebook' && '[&>svg:first-child]:text-blue-500')
}

export const sidebarMenuButtonActiveClass =
  'data-[active=true]:dashboard-nav-active data-[active=true]:rounded-md'

export const sidebarSubButtonActiveClass =
  'data-[active=true]:dashboard-nav-active data-[active=true]:rounded-md'

export const sidebarDropdownLinkActiveClass =
  'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
