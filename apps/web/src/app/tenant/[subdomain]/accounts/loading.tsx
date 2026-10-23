/** Accounts route loading (spec 137 §3.3.3 / PR-A2) — card-grid geometry. */
import * as React from "react";

import { Skeleton } from "@/components/shared/ui/skeleton";

export default function AccountsLoading() {
  return (
    <div aria-busy="true" aria-label="Loading accounts" className="flex flex-col gap-6 px-6 py-6">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-40" />
      </div>
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}
