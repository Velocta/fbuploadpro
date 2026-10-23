/** Settings loading (spec 137 §3.3.3 / PR-A2) — tab rail + form panel. */
import * as React from "react";

import { Skeleton } from "@/components/shared/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div aria-busy="true" aria-label="Loading settings" className="flex gap-6 px-6 py-6">
      <div className="flex w-48 shrink-0 flex-col gap-2">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
      <div className="flex w-full max-w-2xl flex-col gap-4 rounded-md border border-line bg-panel p-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}
