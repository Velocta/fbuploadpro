import { Skeleton } from '@/components/ui/skeleton'

function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-border/50 bg-background/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-4 rounded-full" />
      </div>
      <Skeleton className="mb-2 h-8 w-16" />
      <Skeleton className="h-3 w-32" />
    </div>
  )
}

export function SchedulePageDetailSkeleton() {
  return (
    <div className="space-y-6 pb-8 agency-motion-standard animate-in fade-in duration-300">
      <div className="relative group">
        <div
          className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 to-blue-500/20 opacity-40 blur-xl"
          aria-hidden
        />
        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/40 p-6 shadow-2xl backdrop-blur-xl">
          <nav className="mb-5 flex flex-wrap items-center gap-2">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-3 w-32" />
          </nav>

          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-4">
              <Skeleton className="h-14 w-14 shrink-0 rounded-2xl" />
              <div className="min-w-0 flex-1 space-y-2.5">
                <Skeleton className="h-8 w-56 max-w-full" />
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-6 w-32 rounded-full" />
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Skeleton className="h-5 w-28 rounded-md" />
                  <Skeleton className="h-5 w-24 rounded-md" />
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Skeleton className="h-10 w-24 rounded-full" />
              <Skeleton className="h-10 w-28 rounded-full" />
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-10 w-36 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      <div className="relative group">
        <div
          className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 to-blue-500/20 opacity-40 blur-xl"
          aria-hidden
        />
        <div className="relative rounded-2xl border border-border/50 bg-card/40 p-2 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-wrap gap-1 rounded-xl border border-border/50 bg-muted/50 p-1">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 min-w-[140px] flex-1 rounded-lg" />
            ))}
          </div>
        </div>
      </div>

      <div className="relative">
        <div className="grid gap-4 rounded-2xl border border-border/50 bg-card/40 p-5 shadow-2xl backdrop-blur-xl sm:grid-cols-2">
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      </div>
    </div>
  )
}
