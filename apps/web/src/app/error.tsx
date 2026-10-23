"use client";

/** Root segment error boundary (spec 137 §3.3 / PR-A2). */
import * as React from "react";

import { BoundaryError } from "./_boundaries/route-boundary";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <BoundaryError error={error} reset={reset} homeHref="/" homeLabel="Go to home" />;
}
