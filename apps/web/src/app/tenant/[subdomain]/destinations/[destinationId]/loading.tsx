/** Destination section loading (spec 137 §3.3.3 / PR-A2) — refined to
 * the rebuilt frame's final geometry (spec 131 PR-131-4, §8.8):
 * identity header + summary panel + the four slot sections. */
import * as React from "react";

import { Skeleton } from "@/components/shared/ui/skeleton";

export default function DestinationLoading() {
  return (
    <div aria-busy="true" aria-label="Loading destination" className="mx-auto flex w-full max-w-300 flex-col gap-6 px-6 py-6">
      <Skeleton className="h-4 w-28" />
      <div className="flex items-center gap-4">
        <Skeleton className="size-12 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-36" />
        </div>
      </div>
      <div className="flex flex-col gap-4 rounded-md border border-line bg-panel p-6">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="flex flex-col gap-8">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}
