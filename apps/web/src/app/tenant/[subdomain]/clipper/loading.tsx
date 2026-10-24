/** Clipper loading — centred card placeholder, mirroring Fdola Studio. */
import * as React from "react";

import { Skeleton } from "@/components/shared/ui/skeleton";

export default function TenantClipperLoading() {
  return (
    <div aria-busy="true" aria-label="Loading Clipper" className="flex items-center justify-center px-6 py-12">
      <Skeleton className="h-44 w-full max-w-120" />
    </div>
  );
}
