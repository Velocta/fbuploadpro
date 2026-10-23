/** Root segment not-found boundary (spec 137 §3.3 / PR-A2). */
import * as React from "react";

import { BoundaryNotFound } from "./_boundaries/route-boundary";

export default function RootNotFound() {
  return <BoundaryNotFound homeHref="/" homeLabel="Go to home" />;
}
