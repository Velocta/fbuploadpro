import { CalendarClock, XCircle, CheckCircle2, Users2, TrendingUp, UserPlus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

type StatTile = {
  label: string
  value: string | number
  description: string
  icon: LucideIcon
  accent?: 'default' | 'primary' | 'destructive' | 'success' | 'info'
}

function StatTileCard({ stat }: { stat: StatTile }) {
  const Icon = stat.icon
  return (
    <div
      className={cn(
        'rounded-xl border border-border/50 bg-background/30 p-4',
        stat.accent === 'primary' && 'border-primary/20 bg-primary/5',
        stat.accent === 'success' && 'border-emerald-500/20 bg-emerald-500/5',
        stat.accent === 'destructive' && 'border-destructive/20 bg-destructive/5',
      )}
    >
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon
          className={cn(
            'h-4 w-4',
            stat.accent === 'primary' && 'text-primary',
            stat.accent === 'success' && 'text-emerald-500',
            stat.accent === 'destructive' && 'text-destructive',
            stat.accent === 'default' && 'text-primary',
          )}
        />
        {stat.label}
      </div>
      <p
        className={cn(
          'font-display text-2xl font-bold tracking-tight',
          stat.accent === 'primary' && 'text-primary',
          stat.accent === 'success' && 'text-emerald-500',
          stat.accent === 'destructive' && 'text-destructive',
        )}
      >
        {stat.value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{stat.description}</p>
    </div>
  )
}

export function OverviewTab({
  stats,
  page,
}: {
  stats: { pending: number; failed: number; published: number }
  page: {
    followers_count: number | null
    followers_gained: number | null
    changed_followers: number | null
  }
}) {
  const currentFollowers = page.followers_gained ?? 0
  const initialFollowers = page.followers_count ?? 0
  const netFollowers = page.changed_followers ?? 0

  const uiStats: StatTile[] = [
    {
      label: 'Current Followers',
      value: currentFollowers.toLocaleString(),
      description: 'Total active page followers',
      icon: Users2,
      accent: 'default',
    },
    {
      label: 'Followers Gained',
      value: (netFollowers >= 0 ? '+' : '') + netFollowers.toLocaleString(),
      description: 'Net growth since tracking',
      icon: TrendingUp,
      accent: netFollowers >= 0 ? 'success' : 'destructive',
    },
    {
      label: 'Initial Followers',
      value: initialFollowers.toLocaleString(),
      description: 'Followers when page was added',
      icon: UserPlus,
      accent: 'default',
    },
    {
      label: 'Queue (Pending)',
      value: stats.pending.toLocaleString(),
      description: 'Posts queued for publishing',
      icon: CalendarClock,
      accent: 'primary',
    },
    {
      label: 'Published',
      value: stats.published.toLocaleString(),
      description: 'Successfully published posts',
      icon: CheckCircle2,
      accent: 'success',
    },
    {
      label: 'Failed',
      value: stats.failed.toLocaleString(),
      description: 'Failed to publish',
      icon: XCircle,
      accent: 'destructive',
    },
  ]

  return (
    <div className="relative group">
      <div
        className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 to-blue-500/20 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100"
        aria-hidden
      />
      <div className="relative grid gap-4 rounded-2xl border border-border/50 bg-card/40 p-5 shadow-2xl backdrop-blur-xl sm:grid-cols-2 lg:grid-cols-3">
        {uiStats.map((stat) => (
          <StatTileCard key={stat.label} stat={stat} />
        ))}
      </div>
    </div>
  )
}
