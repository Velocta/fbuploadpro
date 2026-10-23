/**
 * Tenant segment + workspace-home loading boundary (spec 137 §3.3 / PR-A2;
 * geometry aligned to the rebuilt home in spec 130 §5.5 / PR-130-3).
 * This file is both the tenant segment's generic skeleton and the home
 * route's own loading state (the home page lives in this same segment);
 * routes with materially different geometry ship their own loading.tsx.
 * It renders inside the tenant layout — sidebar and header stay in place.
 *
 * Geometry contract (UI Rule 17 / matrix §17 — skeleton at final
 * geometry): the outer measure and padding are the home page's own
 * (`mx-auto w-full max-w-3xl px-6 py-6`), and the panel is the same
 * shared/ui `Card` the home ships (`gap-1 px-6` over the primitive's
 * `py-6`), so the loaded card replaces this skeleton without layout
 * shift. Rows mirror the home's content: the heading line (`h-7` ≈ the
 * `text-xl` heading's line box), then the welcome line at full width
 * plus its wrapped second line at small widths (`w-2/3`). The heading
 * skeleton is capped with `max-w-full` so it can never push past the
 * card's content box at 320px.
 */
import * as React from "react";

import { Card } from "@/components/shared/ui/card";
import { Skeleton } from "@/components/shared/ui/skeleton";

export default function TenantLoading() {
  return (
    <div aria-busy="true" aria-label="Loading workspace" className="mx-auto w-full max-w-3xl px-6 py-6">
      <Card className="gap-1 px-6">
        <Skeleton className="h-7 w-64 max-w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </Card>
    </div>
  );
}
