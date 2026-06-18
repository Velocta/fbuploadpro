import { AgencyGlassPageHero } from '@/components/dashboard/agency'
import { CalendarClock } from 'lucide-react'

function DirectScheduleSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats Skeleton */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl border border-border/50 bg-card/40 p-5 animate-pulse flex flex-col justify-between">
            <div className="h-4 w-24 bg-muted/20 rounded" />
            <div className="h-6 w-16 bg-muted/20 rounded" />
          </div>
        ))}
      </div>

      {/* Pages Grid Skeleton */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[200px] rounded-2xl border border-border/50 bg-card/40 p-5 animate-pulse flex flex-col justify-between">
            <div className="flex gap-3">
              <div className="h-12 w-12 bg-muted/20 rounded-lg" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-32 bg-muted/20 rounded" />
                <div className="h-3 w-20 bg-muted/20 rounded" />
              </div>
            </div>
            <div className="h-10 bg-muted/20 rounded-lg w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DirectScheduleLoading() {
  return (
    <div className="space-y-6 pb-8 agency-motion-standard">
      <AgencyGlassPageHero
        segments={[
          { label: 'Agency', href: '/agency' },
          { label: 'Direct Schedule' },
        ]}
        icon={<CalendarClock className="h-7 w-7 text-primary" />}
        title="Direct Schedule"
        description="Schedule posts natively on Facebook."
      />
      <DirectScheduleSkeleton />
    </div>
  )
}
