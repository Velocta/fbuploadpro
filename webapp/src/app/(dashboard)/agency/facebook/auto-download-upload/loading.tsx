import { Skeleton } from '@/components/ui/skeleton'

export default function AduHubLoading() {
  return (
    <div className="space-y-6 agency-motion-standard pb-8">
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/40 p-6 shadow-2xl backdrop-blur-xl">
        <Skeleton className="mb-4 h-3 w-48" />
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex gap-4">
            <Skeleton className="h-14 w-14 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-80" />
            </div>
          </div>
          <Skeleton className="h-11 w-36 rounded-xl" />
        </div>
      </div>

      <div className="grid gap-4 rounded-2xl border border-border/50 bg-card/40 p-5 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-border/50 bg-background/30 p-4">
            <Skeleton className="mb-3 h-3 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-10 flex-1 min-w-[200px] rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
