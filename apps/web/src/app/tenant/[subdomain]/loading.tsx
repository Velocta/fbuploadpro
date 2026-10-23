/**
 * Tenant segment + workspace-home loading boundary (spec 137 §3.3 / PR-A2).
 * This file is both the tenant segment's generic skeleton and the home
 * route's own loading state (the home page lives in this same segment);
 * routes with materially different geometry ship their own loading.tsx.
 * It renders inside the tenant layout — sidebar and header stay in place.
 */
import * as React from "react";

import { Skeleton } from "@/components/shared/ui/skeleton";

export default function TenantLoading() {
  return (
    <div aria-busy="true" aria-label="Loading workspace" className="mx-auto w-full max-w-3xl px-6 py-6">
      <div className="flex flex-col gap-4 rounded-md border border-line bg-panel p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}
