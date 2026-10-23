/** Media Library loading (spec 137 §3.3.3 / PR-A2) — header, toolbar, and
 * the tile grid at the rebuilt browse geometry (spec 133 PR-133-2:
 * 2/3/4/5 columns, 16:9 tiles with a two-line metadata stack). */
import * as React from "react";

import { Skeleton } from "@/components/shared/ui/skeleton";

export default function MediaLoading() {
  return (
    <div aria-busy="true" aria-label="Loading media library" className="flex flex-col px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="flex items-center gap-4 border-b border-line pb-4">
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
        <Skeleton className="ml-auto h-10 w-28" />
      </div>
      <div className="grid grid-cols-2 gap-4 pt-4 md:grid-cols-3 md:gap-5 xl:grid-cols-4 2xl:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="flex flex-col gap-1">
            <Skeleton className="aspect-video w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
