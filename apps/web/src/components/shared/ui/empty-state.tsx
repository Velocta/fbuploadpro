/**
 * EmptyState — built new (shadcn has none). Typed by cause (UI Rule 23 /
 * UX Rule 6 / matrix §18): each type ships its own headline pattern and
 * EXACTLY ONE primary action.
 * - first-use: what belongs here + its value, one create/connect action.
 * - no-results: echoes the active filters, one "clear filters" action.
 * - cleared: positive confirmation of a finished state, no CTA pressure —
 *   pass no action.
 * - no-permission: why it is empty and who can fix it, one action at most.
 */
import * as React from "react";

import { cn } from "@/lib/utils";

const EMPTY_STATE_TYPES = ["first-use", "no-results", "cleared", "no-permission"] as const;
type EmptyStateType = (typeof EMPTY_STATE_TYPES)[number];

type EmptyStateProps = React.ComponentProps<"div"> & {
  type: EmptyStateType;
  title: string;
  description?: string;
  /** Exactly one primary action (omit for `cleared`). */
  action?: React.ReactNode;
  icon?: React.ReactNode;
  /** For no-results: the applied filters, echoed back to the user. */
  activeFilters?: string[];
};

function EmptyState({ type, title, description, action, icon, activeFilters, className, ...props }: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      data-type={type}
      role="status"
      className={cn("flex flex-col items-center gap-2 px-6 py-12 text-center", className)}
      {...props}
    >
      {icon}
      <h2 className="text-lg leading-heading font-semibold text-ink">{title}</h2>
      {description ? <p className="max-w-md text-body text-ink-sub">{description}</p> : null}
      {type === "no-results" && activeFilters && activeFilters.length > 0 ? (
        <p className="text-metadata text-ink-dim">Active filters: {activeFilters.join(", ")}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export { EmptyState, EMPTY_STATE_TYPES };
export type { EmptyStateProps, EmptyStateType };
