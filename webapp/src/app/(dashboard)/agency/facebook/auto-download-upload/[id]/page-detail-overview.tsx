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
}: {
  pendingReels: number
  postedReels: number
  failedReels: number
  followersDelta: number
}) {
  const stats: StatTile[] = [
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

  return (
    <div className="relative group">
      <div
        className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 to-blue-500/20 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100"
        aria-hidden
      />
      <div className="relative grid gap-4 rounded-2xl border border-border/50 bg-card/40 p-5 shadow-2xl backdrop-blur-xl sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatTileCard key={stat.label} stat={stat} />
        ))}
      </div>
    </div>
  )
}
