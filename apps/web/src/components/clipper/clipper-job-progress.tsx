'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CLIP_STAGE_LABELS, type ClipJob } from '@fbuploadpro/contracts';
import { Alert, AlertDescription, AlertTitle, Button } from '@/components/shared/ui';

export interface ClipperJobProgressProps {
  job: ClipJob;
  onCancel?: () => void;
  cancelling?: boolean;
}

const ACTIVE_STATUSES: ClipJob['status'][] = ['probing', 'downloading-model', 'transcribing', 'selecting', 'exporting'];
const CANCELLABLE_STATUSES: ClipJob['status'][] = ['downloading-model', 'transcribing', 'exporting'];

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Stage label + stage percent + elapsed time (real clock, never an ETA)
 * + Cancel (transcribing/exporting/model download only) + failure Alert
 * with a Details expander for the technical error.
 */
export function ClipperJobProgress({ job, onCancel, cancelling = false }: Readonly<ClipperJobProgressProps>) {
  const [tick, setTick] = useState(0);
  const snapshotRef = useRef({ updatedAt: job.updatedAt, elapsedSeconds: job.elapsedSeconds ?? 0, atMs: Date.now() });
  if (snapshotRef.current.updatedAt !== job.updatedAt) {
    snapshotRef.current = { updatedAt: job.updatedAt, elapsedSeconds: job.elapsedSeconds ?? 0, atMs: Date.now() };
  }
  const isActive = ACTIVE_STATUSES.includes(job.status);
  useEffect(() => {
    if (!isActive) return undefined;
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, [isActive]);
  void tick;
  const elapsedSeconds =
    snapshotRef.current.elapsedSeconds + (isActive ? Math.floor((Date.now() - snapshotRef.current.atMs) / 1000) : 0);

  return (
    <section data-testid="clipper-job-progress" aria-label="Job progress" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span data-testid="clipper-stage-label" className="text-body font-medium text-ink">
          {CLIP_STAGE_LABELS[job.status]}
        </span>
        <span data-testid="clipper-elapsed" className="text-body tabular-nums text-ink-sub">
          {formatElapsed(elapsedSeconds)} elapsed
        </span>
      </div>
      <progress
        data-testid="clipper-progress-bar"
        value={job.stagePercent}
        max={100}
        aria-label={`${CLIP_STAGE_LABELS[job.status]} progress`}
        className="h-2 w-full accent-primary"
      />
      <div className="flex items-center justify-between gap-2">
        <span data-testid="clipper-stage-percent" className="text-body tabular-nums text-ink-sub">
          {job.stagePercent}%
        </span>
        {isActive && CANCELLABLE_STATUSES.includes(job.status) && onCancel && (
          <Button type="button" variant="outline" size="sm" data-testid="clipper-cancel-btn" onClick={onCancel} disabled={cancelling}>
            {cancelling ? 'Cancelling…' : 'Cancel'}
          </Button>
        )}
      </div>
      {job.status === 'failed' && job.error && (
        <Alert variant="destructive" data-testid="clipper-job-error">
          <AlertTitle>{job.error.message}</AlertTitle>
          {job.error.detail && (
            <AlertDescription>
              <details>
                <summary className="cursor-pointer text-body font-medium">Details</summary>
                <p className="mt-1 break-words text-body">{job.error.detail}</p>
              </details>
            </AlertDescription>
          )}
        </Alert>
      )}
    </section>
  );
}
