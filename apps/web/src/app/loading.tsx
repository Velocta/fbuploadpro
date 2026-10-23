/** Root segment loading boundary (spec 137 §3.3 / PR-A2) — entry routes. */
import * as React from "react";

import { Skeleton } from "@/components/shared/ui/skeleton";

export default function RootLoading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-md border border-line bg-panel p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}
