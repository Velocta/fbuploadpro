/** Fdola Studio loading (spec 141 §5) — centred card placeholder. */
import * as React from "react";

import { Skeleton } from "@/components/shared/ui/skeleton";

export default function FdolaStudioLoading() {
  return (
    <div aria-busy="true" aria-label="Loading Fdola Studio" className="flex items-center justify-center px-6 py-12">
      <Skeleton className="h-44 w-full max-w-120" />
    </div>
  );
}
