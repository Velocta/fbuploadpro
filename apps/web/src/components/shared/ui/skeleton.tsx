/**
 * Skeleton — shadcn base, adapted: a skeleton stands at the FINAL geometry
 * of the content it replaces (UI Rule 16) — consumers size it with the same
 * width/height utilities as the real content. Decorative: aria-hidden by
 * default; wrap a loading region in aria-busy at the surface level.
 */
import * as React from "react";

import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden={props["aria-hidden"] ?? true}
      className={cn("animate-pulse rounded-sm bg-subtle", className)}
      {...props}
    />
  );
}

export { Skeleton };
