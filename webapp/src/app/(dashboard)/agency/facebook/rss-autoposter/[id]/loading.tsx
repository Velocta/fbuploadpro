import { Skeleton } from '@/components/ui/skeleton'

export default function RssAutoposterDetailLoading() {
  return (
    <div className="space-y-6 pb-8 agency-motion-standard animate-in fade-in duration-300">
      <div className="relative group">
        <div
          className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 to-blue-500/20 opacity-40 blur-xl"
          aria-hidden
        />
        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/40 p-6 shadow-2xl backdrop-blur-xl">
          <Skeleton className="mb-4 h-3 w-56" />
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex gap-4">
              <Skeleton className="h-14 w-14 rounded-2xl" />
              <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-72" />
              </div>
            </div>
            <Skeleton className="h-11 w-24 rounded-xl" />
          </div>
        </div>
      </div>

      <Skeleton className="h-[72px] w-full rounded-2xl" />

      <div className="rounded-2xl border border-border/50 bg-card/40 p-2 shadow-2xl backdrop-blur-xl">
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>

      <div className="space-y-4 rounded-2xl border border-border/50 bg-card/40 p-5 shadow-2xl backdrop-blur-xl">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-40 rounded-xl" />
      </div>
    </div>
  )
}
