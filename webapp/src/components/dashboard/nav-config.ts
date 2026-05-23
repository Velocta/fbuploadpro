import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Building2,
  Calendar,
  CalendarClock,
  Download,
  Facebook,
  Instagram,
  Send,
  Settings,
  Trash2,
  Youtube,
} from 'lucide-react'

export type NavBadge = 'soon'

export type NavItemConfig = {
  title: string
  href: string
  icon: LucideIcon
  requiresTokens?: boolean
  badge?: NavBadge
}

export type NavGroupConfig = {
  id: string
  title: string
  icon: LucideIcon
  requiresTokens?: boolean
  badge?: NavBadge
  items: NavItemConfig[]
}

export type FlatNavItemConfig = {
  title: string
  href: string
  icon: LucideIcon
}

export const agencyDashboardItem: FlatNavItemConfig = {
  title: 'Dashboard',
  href: '/agency',
  icon: BarChart3,
}

export const agencyNavGroups: NavGroupConfig[] = [
  {
    id: 'facebook',
    title: 'Facebook',
    icon: Facebook,
    requiresTokens: true,
    items: [
      { title: 'Accounts', href: '/agency/facebook/accounts', icon: Building2, requiresTokens: true },
      {
        title: 'Auto Download/Upload',
        href: '/agency/facebook/auto-download-upload',
        icon: Download,
        requiresTokens: true,
      },
      { title: 'Bulk Delete Posts', href: '/agency/facebook/bulk-delete', icon: Trash2, requiresTokens: true },
      { title: 'Direct Post', href: '/agency/facebook/direct-post', icon: Send, requiresTokens: true },
      { title: 'Direct Schedule', href: '/agency/facebook/direct-schedule', icon: Calendar, requiresTokens: true },
      { title: 'InApp Schedule', href: '/agency/facebook/inapp-schedule', icon: CalendarClock, requiresTokens: true },
    ],
  },
  {
    id: 'youtube',
    title: 'YouTube',
    icon: Youtube,
    items: [
      { title: 'Accounts', href: '/agency/youtube/accounts', icon: Building2 },
      { title: 'Direct Post', href: '/agency/youtube/direct-post', icon: Send },
      { title: 'Direct Schedule', href: '/agency/youtube/direct-schedule', icon: Calendar },
      { title: 'InApp Schedule', href: '/agency/youtube/inapp-schedule', icon: CalendarClock },
    ],
  },
  {
    id: 'instagram',
    title: 'Instagram',
    icon: Instagram,
    items: [
      { title: 'Accounts', href: '/agency/instagram/accounts', icon: Building2 },
      { title: 'Direct Post', href: '/agency/instagram/direct-post', icon: Send },
      { title: 'Direct Schedule', href: '/agency/instagram/direct-schedule', icon: Calendar },
      { title: 'InApp Schedule', href: '/agency/instagram/inapp-schedule', icon: CalendarClock },
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    icon: Settings,
    items: [
      { title: 'Facebook BYOC', href: '/agency/settings/facebook-byoc', icon: Facebook },
      { title: 'YouTube BYOC', href: '/agency/settings/youtube-byoc', icon: Youtube },
      { title: 'Instagram BYOC', href: '/agency/settings/instagram-byoc', icon: Instagram },
    ],
  },
]

export const superAdminNavItems: FlatNavItemConfig[] = [
  { title: 'Overview', href: '/super-admin', icon: BarChart3 },
  { title: 'Agencies', href: '/super-admin/agencies', icon: Building2 },
]

export const adminNavItems: FlatNavItemConfig[] = [
  { title: 'Overview', href: '/admin', icon: BarChart3 },
  { title: 'Agencies', href: '/admin/agencies', icon: Building2 },
]

export const STORAGE_GROUPS_KEY = 'fbuploadpro-sidebar-groups'
export const LEGACY_COLLAPSED_KEY = 'fbuploadpro-sidebar-collapsed'
export const ADD_TOKENS_HREF = '/agency?addTokens=1'
