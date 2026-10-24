'use client';

/**
 * Typed empty states for the unified destination queue (spec 134
 * PR-134-3, UI Rule 23 — typed by cause, never one generic message).
 * The destination counterpart of the Page panel's QueueEmptyStates:
 * that component is bound to the legacy Page data path (its quick-add
 * writes legacy page slots, its checklist is a per-Page preference),
 * so the destination panel carries its own states on the same
 * EmptyState primitive — the states differ because the causes differ:
 *
 * - setup-incomplete: the destination has no ACTIVE posting time, so
 *   a queued post could not be placed — the one primary action is
 *   adding a posting time, inline (the unified slots write).
 * - first-use: nothing has been queued here yet; what belongs here is
 *   stated, and creation is named where it lives (the Composer
 *   section of this destination) — no dead create control here.
 * - no-results: echoes the active filter with Clear filters.
 * - queue-clear: pending work is done; published/failed history
 *   remains under its filters. No action (the `cleared` type).
 */
import * as React from 'react';

import { Button } from '@/components/shared/ui/button';
import { EmptyState } from '@/components/shared/ui/empty-state';

export type DestinationQueueEmptyVariant =
  | 'first-use'
  | 'no-results'
  | 'setup-incomplete'
  | 'queue-clear';

export interface DestinationQueueEmptyStatesProps {
  variant: DestinationQueueEmptyVariant;
  /** Active filter label, echoed by the no-results state. */
  filterLabel?: string;
  onClearFilters?: () => void;
  /** Adds a posting time ('HH:MM') through the unified slots write;
   *  resolves false when the write failed (the state shows the error). */
  onAddSlot?: (timeOfDay: string) => Promise<boolean>;
}

export function DestinationQueueEmptyStates({
  variant,
  filterLabel,
  onClearFilters,
  onAddSlot,
}: Readonly<DestinationQueueEmptyStatesProps>) {
  const [timeValue, setTimeValue] = React.useState('09:00');
  const [adding, setAdding] = React.useState(false);
  const [addError, setAddError] = React.useState<string | null>(null);

  if (variant === 'no-results') {
    return (
      <div data-testid="destination-queue-empty-state">
        <EmptyState
          type="no-results"
          title="Nothing here."
          description="No posts match this filter."
          {...(filterLabel ? { activeFilters: [filterLabel] } : {})}
          action={
            <Button variant="secondary" onClick={onClearFilters}>
              Clear filters
            </Button>
          }
        />
      </div>
    );
  }

  if (variant === 'setup-incomplete') {
    const handleAdd = async () => {
      if (!onAddSlot || !timeValue) return;
      setAdding(true);
      setAddError(null);
      const ok = await onAddSlot(timeValue);
      setAdding(false);
      if (!ok) {
        setAddError("Couldn't add that posting time. Please try again.");
      }
    };
    return (
      <div data-testid="destination-queue-empty-state">
        <EmptyState
          type="first-use"
          title="No posting times yet."
          description="Add a posting time so queued posts know when to go out. You can fine-tune posting times in the Posting times section below."
          action={
            <form
              className="flex flex-wrap items-end justify-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void handleAdd();
              }}
            >
              <label className="flex flex-col items-start gap-1 text-left">
                <span className="text-metadata font-medium text-ink-sub">
                  Posting time
                </span>
                <input
                  type="time"
                  value={timeValue}
                  onChange={(event) => setTimeValue(event.target.value)}
                  className="min-h-11 rounded-sm border border-line bg-panel px-3 text-body text-ink outline-none focus-visible:outline-2 focus-visible:outline-brand-gold"
                />
              </label>
              <Button type="submit" loading={adding} disabled={!timeValue}>
                Add posting time
              </Button>
            </form>
          }
        />
        {addError && (
          <p role="alert" className="text-center text-metadata text-brand-rose">
            {addError}
          </p>
        )}
      </div>
    );
  }

  if (variant === 'queue-clear') {
    return (
      <div data-testid="destination-queue-empty-state">
        <EmptyState
          type="cleared"
          title="All caught up."
          description="Nothing is waiting to go out. Published and failed posts stay under their filters above."
        />
      </div>
    );
  }

  return (
    <div data-testid="destination-queue-empty-state">
      <EmptyState
        type="first-use"
        title="Nothing here yet."
        description="Posts you compose for this destination will line up here, in the order they will go out. Create one in the Composer section of this destination."
      />
    </div>
  );
}
