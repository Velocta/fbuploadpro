"use client";

/**
 * Shared route-boundary UI (spec 137 §3.3 / PR-A2).
 *
 * The root and tenant segment `error.tsx` / `not-found.tsx` files are thin
 * wrappers over these components so every segment presents the same
 * designed state: an Alert-framed error with Retry + an escape action,
 * and a typed EmptyState for not-found. Built only from
 * `components/shared/ui/` primitives (Alert / Button / EmptyState) with
 * colour + icon + text status presentation. Copy is plain language and
 * never shows the raw error.
 */
import * as React from "react";
import Link from "next/link";
import { CircleAlertIcon, CompassIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/shared/ui/alert";
import { Button } from "@/components/shared/ui/button";
import { EmptyState } from "@/components/shared/ui/empty-state";
import { reportError } from "@/lib/report-error";

/**
 * Derive the tenant dashboard href from a pathname inside the tenant
 * segment (`/tenant/<subdomain>/…`). Falls back to the app root for
 * clean tenant-host paths, where `/` is the workspace home.
 */
export function tenantHomeHrefFromPathname(pathname: string | null): string {
  const segments = (pathname ?? "").split("/").filter(Boolean);
  if (segments[0] === "tenant" && segments[1]) {
    return `/tenant/${segments[1]}`;
  }
  return "/";
}

export interface BoundaryErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  /** Escape action target (segment home / dashboard). */
  homeHref: string;
  homeLabel: string;
}

export function BoundaryError({ error, reset, homeHref, homeLabel }: BoundaryErrorProps) {
  React.useEffect(() => {
    reportError(error, { source: "error-boundary" });
  }, [error]);

  return (
    <div className="flex items-center justify-center px-6 py-12">
      <Alert variant="destructive" className="max-w-lg">
        <CircleAlertIcon aria-hidden />
        <div className="flex flex-col gap-1">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>
            This page could not be loaded. Your work is saved — try again, or go back to your
            dashboard.
          </AlertDescription>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" onClick={() => reset()}>
              Try again
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href={homeHref}>{homeLabel}</Link>
            </Button>
          </div>
        </div>
      </Alert>
    </div>
  );
}

export interface BoundaryNotFoundProps {
  /** The one primary action target (segment home / dashboard). */
  homeHref: string;
  homeLabel: string;
}

export function BoundaryNotFound({ homeHref, homeLabel }: BoundaryNotFoundProps) {
  return (
    <div className="flex items-center justify-center px-6 py-12">
      {/* Typed by cause: a missing route is the dedicated `not-found`
          cause (spec 130 §5.7, discharging spec 137 §11(a)). */}
      <EmptyState
        type="not-found"
        icon={<CompassIcon aria-hidden className="size-8 text-ink-dim" />}
        title="This page is not here"
        description="The page you are looking for may have moved or no longer exists."
        action={
          <Button asChild>
            <Link href={homeHref}>{homeLabel}</Link>
          </Button>
        }
      />
    </div>
  );
}
