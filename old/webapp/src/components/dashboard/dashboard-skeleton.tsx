import { CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-2xl border border-border/50 bg-card/40 p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-border/50 bg-background/30 p-4">
              <Skeleton className="mb-3 h-3 w-24" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="mt-2 h-3 w-32" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-border/50 bg-background/30 p-4">
          <Skeleton className="mb-4 h-3 w-28" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-lg border border-border/40 p-4">
                <Skeleton className="mb-2 h-3 w-20" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="mt-2 h-3 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-[72px] rounded-xl" />
        <Skeleton className="h-[72px] rounded-xl" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Skeleton key={i} className="h-[72px] rounded-xl" />
        ))}
      </div>
      <div className="rounded-2xl border border-border/50 bg-card/40 p-6">
        <CardHeader className="space-y-0 p-0 pb-4">
          <Skeleton className="h-4 w-36" />
        </CardHeader>
        <CardContent className="space-y-3 p-0">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </CardContent>
      </div>
    </div>
  )
}
