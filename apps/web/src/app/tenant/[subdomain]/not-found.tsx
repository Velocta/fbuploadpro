"use client";

/** Tenant segment not-found boundary (spec 137 §3.3 / PR-A2). */
import * as React from "react";
import { usePathname } from "next/navigation";

import { BoundaryNotFound, tenantHomeHrefFromPathname } from "../../_boundaries/route-boundary";

export default function TenantNotFound() {
  const pathname = usePathname();
  return (
    <BoundaryNotFound homeHref={tenantHomeHrefFromPathname(pathname)} homeLabel="Go to dashboard" />
  );
}
