"use client";

/**
 * Root global error boundary (spec 137 §3.3.1 / PR-A2).
 *
 * This replaces the root layout on catastrophic failure, so it renders
 * its own <html>/<body> and imports globals.css explicitly. It uses the
 * shared primitives minimally (Alert + Button) and ALSO ships a small
 * self-contained fallback stylesheet — values interpolated from the
 * generated token mirror in lib/theme.ts, never literals — so the
 * Binance identity basics (dark ground, gold primary action) hold even
 * if the CSS pipeline itself is what failed.
 */
import * as React from "react";
import "./globals.css";
import { CircleAlertIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/shared/ui/alert";
import { Button } from "@/components/shared/ui/button";
import { reportError } from "@/lib/report-error";
import { PALETTE, THEME } from "@/lib/theme";

const fallbackCss = `
  body { background: ${THEME.default.surfaces.canvas}; color: ${THEME.default.text.primary}; font-family: system-ui, sans-serif; margin: 0; }
  [data-slot="alert"] { background: ${THEME.default.surfaces.panel}; border: 1px solid ${PALETTE.accent3}; border-radius: 0.5rem; }
  [data-slot="button"] { background: ${PALETTE.primary}; color: ${THEME.default.text.onPrimary}; border-radius: 0.375rem; }
`;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    reportError(error, { source: "global-error-boundary" });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <style>{fallbackCss}</style>
        <div className="flex min-h-screen items-center justify-center px-6 py-12">
          <Alert variant="destructive" className="max-w-lg">
            <CircleAlertIcon aria-hidden />
            <div className="flex flex-col gap-1">
              <AlertTitle>Something went wrong</AlertTitle>
              <AlertDescription>
                The app could not load. Your work is saved — try again in a moment.
              </AlertDescription>
              <div className="mt-3">
                <Button type="button" onClick={() => reset()}>
                  Try again
                </Button>
              </div>
            </div>
          </Alert>
        </div>
      </body>
    </html>
  );
}
