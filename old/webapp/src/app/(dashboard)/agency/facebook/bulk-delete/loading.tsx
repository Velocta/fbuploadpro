import { Skeleton } from '@/components/ui/skeleton'

export default function BulkDeleteLoading() {
  return (
    <div className="space-y-6 agency-motion-standard pb-8">
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/40 p-6 shadow-2xl backdrop-blur-xl">
        <Skeleton className="mb-4 h-3 w-52" />
        <div className="flex gap-4">
          <Skeleton className="h-14 w-14 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-52" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-2xl space-y-4 py-12">
        <Skeleton className="mx-auto h-16 w-16 rounded-2xl" />
        <Skeleton className="mx-auto h-8 w-56" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    </div>
  )
}
