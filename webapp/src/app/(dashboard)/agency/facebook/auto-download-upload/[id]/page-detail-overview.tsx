import { CheckCircle2, Clock, Users, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

type StatTile = {
  label: string
  value: string | number
  description: string
  icon: LucideIcon
  accent?: 'default' | 'primary' | 'destructive'
}

function StatTileCard({ stat }: { stat: StatTile }) {
  const Icon = stat.icon
  return (
    <div
      className={cn(
        'rounded-xl border border-border/50 bg-background/30 p-4',
        stat.accent === 'primary' && 'border-primary/20 bg-primary/5',
        stat.accent === 'destructive' && 'border-destructive/20 bg-destructive/5',
      )}
    >
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon
          className={cn(
            'h-4 w-4',
            stat.accent === 'primary' && 'text-primary',
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
          stat.accent === 'destructive' && 'text-destructive',
        )}
      >
        {stat.value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{stat.description}</p>
    </div>
  )
}

export function PageDetailOverview({
  pendingReels,
  postedReels,
  failedReels,
  followersDelta,
  postsPerDay = 0,
  postedToday = 0,
  failedToday = 0,
}: {
  pendingReels: number
  postedReels: number
  failedReels: number
  followersDelta: number
  postsPerDay?: number
  postedToday?: number
  failedToday?: number
}) {
  const totalStats: StatTile[] = [
    {
      label: 'Total Pending',
      value: pendingReels,
      description: 'Reels ready for posting',
      icon: Clock,
      accent: 'default',
    },
    {
      label: 'Total Posted',
      value: postedReels,
      description: 'Successful automations',
      icon: CheckCircle2,
      accent: 'primary',
    },
    {
      label: 'Failed Posts',
      value: failedReels,
      description: 'Require attention',
      icon: XCircle,
      accent: 'destructive',
    },
    {
      label: 'Followers Gained',
      value: `${followersDelta > 0 ? '+' : ''}${followersDelta.toLocaleString()}`,
      description: 'Net growth since page onboarding',
      icon: Users,
      accent: followersDelta >= 0 ? 'primary' : 'destructive',
    },
  ]

  const todayStats: StatTile[] = [
    {
      label: 'Pending Today',
      value: Math.max(0, postsPerDay - postedToday),
      description: 'Remaining scheduled posts today',
      icon: Clock,
      accent: 'default',
    },
    {
      label: 'Posted Today',
      value: postedToday,
      description: 'Published since page local midnight',
      icon: CheckCircle2,
      accent: 'primary',
    },
    {
      label: 'Failed Today',
      value: failedToday,
      description: 'Errors since page local midnight',
      icon: XCircle,
      accent: 'destructive',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Total Stats Section */}
      <div className="relative group">
        <div
          className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/10 to-blue-500/10 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100"
          aria-hidden
        />
        <div className="relative rounded-2xl border border-border/50 bg-card/40 p-5 shadow-2xl backdrop-blur-xl">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
            Total Statistics
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {totalStats.map((stat) => (
              <StatTileCard key={stat.label} stat={stat} />
            ))}
          </div>
        </div>
      </div>

      {/* Today's Stats Section */}
      <div className="relative group">
        <div
          className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/10 to-blue-500/10 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100"
          aria-hidden
        />
        <div className="relative rounded-2xl border border-border/50 bg-card/40 p-5 shadow-2xl backdrop-blur-xl">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
            Today's Statistics
          </h3>
          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-3">
            {todayStats.map((stat) => (
              <StatTileCard key={stat.label} stat={stat} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
