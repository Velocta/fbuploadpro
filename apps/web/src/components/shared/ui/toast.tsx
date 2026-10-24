"use client";

/**
 * Toast — ONE toast system product-wide (UI Rule 11): shadcn's approach is
 * Sonner, adapted here to our tokens and to the interruption ladder
 * (UI Rule 2 / matrix §8):
 * - Toasts carry results of a user action that are non-critical and need no
 *   decision ("Saved", "Post queued"); 5s default (the 4–6s band), max 3
 *   visible, pause on hover (Sonner defaults).
 * - A critical or destructive outcome NEVER lives only in a toast — use
 *   Banner (persistent) or AlertDialog (decision). Reversible removals use
 *   a toast WITH Undo (pass an action on the toast call).
 * - Action/cancel buttons are 44px tall (spec 142 F05).
 * - Bottom toasts clear the home indicator (spec 142 F03): the default
 *   `offset` / `mobileOffset` bottom values are
 *   `max(<Sonner's own base>, env(safe-area-inset-bottom))`, preserving
 *   Sonner's shipped bases (24px desktop / 16px mobile) while growing
 *   on notched devices. Only the bottom side is overridden — Sonner
 *   falls back to its defaults for the other sides. Callers can still
 *   override either prop (defaults are set before the {...props}
 *   spread below). The insets are live only because the root layout
 *   exports `viewportFit: 'cover'` (layout.tsx + globals.css pt-safe
 *   family).
 * - Contract-only for now: this Toaster is mounted NOWHERE yet — spec
 *   130 mounts the single shell-level Toaster (audit H-130 / R26).
 * - Styling is token classes via Sonner's classNames slots — no inline
 *   style variables, no second toast implementation anywhere.
 */
import * as React from "react";
import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from "lucide-react";
import { Toaster as Sonner, toast, type ToasterProps } from "sonner";

function Toast({ ...props }: ToasterProps) {
  return (
    <Sonner
      data-slot="toast"
      className="toaster group"
      position={props.position ?? "bottom-right"}
      offset={props.offset ?? { bottom: "max(24px, env(safe-area-inset-bottom))" }}
      mobileOffset={props.mobileOffset ?? { bottom: "max(16px, env(safe-area-inset-bottom))" }}
      visibleToasts={props.visibleToasts ?? 3}
      duration={props.duration ?? 5000}
      closeButton={props.closeButton ?? true}
      icons={{
        success: <CircleCheckIcon className="size-4" aria-hidden />,
        info: <InfoIcon className="size-4" aria-hidden />,
        warning: <TriangleAlertIcon className="size-4" aria-hidden />,
        error: <OctagonXIcon className="size-4" aria-hidden />,
        loading: <Loader2Icon className="size-4 animate-spin" aria-hidden />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group flex items-start gap-2 rounded-md border border-line bg-panel p-4 text-body text-ink shadow-elevated",
          title: "font-medium",
          description: "text-ink-sub",
          actionButton: "bg-primary text-on-primary rounded-sm px-3 h-9 font-medium",
          cancelButton: "bg-subtle text-ink rounded-sm px-3 h-9 font-medium",
          closeButton: "text-ink-sub hover:text-ink",
          success: "text-brand-emerald",
          error: "text-brand-rose",
          warning: "text-brand-gold",
          info: "text-ink",
        },
      }}
      {...props}
    />
  );
}

/** The Toaster name shadcn consumers expect; same single system. */
const Toaster = Toast;

export { Toast, Toaster, toast };
export type { ToasterProps };
