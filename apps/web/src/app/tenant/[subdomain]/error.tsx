"use client";

/** Tenant segment error boundary (spec 137 §3.3 / PR-A2). Renders inside
 *  the tenant layout, so the workspace shell stays in place. */
import * as React from "react";
import { usePathname } from "next/navigation";

import { BoundaryError, tenantHomeHrefFromPathname } from "../../_boundaries/route-boundary";

export default function TenantError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  return (
    <BoundaryError
      error={error}
      reset={reset}
      homeHref={tenantHomeHrefFromPathname(pathname)}
      homeLabel="Go to dashboard"
    />
  );
}
