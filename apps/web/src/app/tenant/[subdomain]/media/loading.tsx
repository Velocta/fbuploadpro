/** Media Library loading (spec 137 §3.3.3 / PR-A2) — toolbar + tile grid. */
import * as React from "react";

import { Skeleton } from "@/components/shared/ui/skeleton";

export default function MediaLoading() {
  return (
    <div aria-busy="true" aria-label="Loading media library" className="flex flex-col gap-6 px-6 py-6">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
        <Skeleton className="aspect-square w-full" />
        <Skeleton className="aspect-square w-full" />
        <Skeleton className="aspect-square w-full" />
        <Skeleton className="aspect-square w-full" />
        <Skeleton className="aspect-square w-full" />
        <Skeleton className="aspect-square w-full" />
        <Skeleton className="aspect-square w-full" />
        <Skeleton className="aspect-square w-full" />
        <Skeleton className="aspect-square w-full" />
        <Skeleton className="aspect-square w-full" />
        <Skeleton className="aspect-square w-full" />
        <Skeleton className="aspect-square w-full" />
      </div>
    </div>
  );
}
