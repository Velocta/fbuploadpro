import Link from 'next/link'
import { Calendar, CalendarClock, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export function DashboardScheduleSnapshot({
  inAppPending,
  directScheduled,
}: {
  inAppPending: number
  directScheduled: number
}) {
  const tiles = [
    {
      label: 'InApp pending',
      count: inAppPending,
      href: '/agency/facebook/inapp-schedule',
      icon: CalendarClock,
      description: 'Queued for in-app publish',
    },
    {
      label: 'Direct scheduled',
      count: directScheduled,
      href: '/agency/facebook/direct-schedule',
      icon: Calendar,
      description: 'Scheduled via Graph API',
    },
  ] as const

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {tiles.map((tile) => {
        const Icon = tile.icon
        return (
          <Link
            key={tile.href}
            href={tile.href}
            className={cn(
              'group flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/30 p-4 transition-colors',
              'hover:border-primary/30 hover:bg-background/50',
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {tile.label}
                </p>
                <p className="font-display text-2xl font-bold tabular-nums tracking-tight text-foreground">
                  {tile.count.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">{tile.description}</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100" />
          </Link>
        )
      })}
    </div>
  )
}
