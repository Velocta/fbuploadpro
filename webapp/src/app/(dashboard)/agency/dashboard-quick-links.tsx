import Link from 'next/link'
import {
  Building2,
  Calendar,
  CalendarClock,
  Download,
  Lock,
  Rss,
  Send,
  Settings2,
  Trash2,
} from 'lucide-react'
import { ADD_TOKENS_HREF } from '@/components/dashboard/nav-config'
import { cn } from '@/lib/utils'

const LINKS = [
  {
    href: '/agency/facebook/accounts',
    label: 'FB Accounts',
    description: 'Connect accounts',
    icon: Building2,
  },
  {
    href: '/agency/facebook/auto-download-upload',
    label: 'Auto Download/Upload',
    description: 'Reel automation',
    icon: Download,
  },
  {
    href: '/agency/facebook/direct-schedule',
    label: 'Direct Schedule',
    description: 'Schedule posts',
    icon: Calendar,
  },
  {
    href: '/agency/facebook/direct-post',
    label: 'Direct Post',
    description: 'Publish now',
    icon: Send,
  },
  {
    href: '/agency/facebook/inapp-schedule',
    label: 'InApp Schedule',
    description: 'In-app queue',
    icon: CalendarClock,
  },
  {
    href: '/agency/facebook/bulk-delete',
    label: 'Bulk Delete',
    description: 'Remove posts',
    icon: Trash2,
  },
  {
    href: '/agency/settings/facebook-byoc',
    label: 'FB BYOC Settings',
    description: 'App credentials',
    icon: Settings2,
  },
  {
    href: '/agency/facebook/rss-autoposter',
    label: 'RSS Auto Poster',
    description: 'Feed automation',
    icon: Rss,
  },
] as const

const RSS_AUTOPOSTER_HREF = '/agency/facebook/rss-autoposter'

export function DashboardQuickLinks({
  hasTokens,
  rssAutoposterEnabled = false,
}: {
  hasTokens: boolean
  rssAutoposterEnabled?: boolean
}) {
  if (!hasTokens) return null

  const links = LINKS.filter(
    (link) => link.href !== RSS_AUTOPOSTER_HREF || rssAutoposterEnabled
  )

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {links.map((link) => {
        const Icon = link.icon
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'group flex items-center gap-3 rounded-xl border border-border/50 bg-background/30 p-4 transition-colors',
              'hover:border-primary/30 hover:bg-background/50',
            )}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary">
                {link.label}
              </p>
              <p className="truncate text-xs text-muted-foreground">{link.description}</p>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

/** Locked placeholder when tokens are zero (optional visual; banner is primary CTA). */
export function DashboardQuickLinksLocked() {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
      <Lock className="h-4 w-4 shrink-0" />
      <span>
        Quick links unlock after you{' '}
        <Link href={ADD_TOKENS_HREF} className="font-medium text-primary hover:underline">
          add tokens
        </Link>
        .
      </span>
    </div>
  )
}
