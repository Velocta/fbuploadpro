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
          actionButton: "bg-primary text-on-primary rounded-sm px-3 h-8 font-medium",
          cancelButton: "bg-subtle text-ink rounded-sm px-3 h-8 font-medium",
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
