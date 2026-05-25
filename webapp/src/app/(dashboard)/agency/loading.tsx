import { Skeleton } from '@/components/ui/skeleton'
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton'

export default function AgencyDashboardLoading() {
  return (
    <div className="space-y-6 agency-motion-standard pb-8">
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/40 p-6 shadow-2xl backdrop-blur-xl">
        <Skeleton className="mb-4 h-3 w-40" />
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex gap-4">
            <Skeleton className="h-14 w-14 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-4 w-72" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
      </div>
      <DashboardSkeleton />
    </div>
  )
}
