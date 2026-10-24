'use client';

import React, { useState } from 'react';
import type { ClipJob } from '@fbuploadpro/contracts';
import { CLIP_STAGE_LABELS } from '@fbuploadpro/contracts';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Card,
  EmptyState,
} from '@/components/shared/ui';

export interface ClipperJobListProps {
  jobs: ClipJob[];
  activeJobId: string | null;
  onSelectJob: (job: ClipJob) => void;
  onRetryJob: (job: ClipJob) => void;
  onDeleteJob: (job: ClipJob) => void;
  onStartNew?: () => void;
}

/** Retry is valid only where re-running can change the outcome. Limit and
 * no-speech failures would fail identically, so they offer "Start new job"
 * (a fresh setup) instead of Retry. */
export function isRetryValid(job: ClipJob): boolean {
  if (job.status !== 'failed') return false;
  const code = job.error?.code;
  if (code === 'INTERRUPTED' || code === 'TRANSCRIPTION_FAILED' || code === 'EXPORT_FAILED') return true;
  return false;
}

export function ClipperJobList(props: Readonly<ClipperJobListProps>) {
  const { jobs, activeJobId, onSelectJob, onRetryJob, onDeleteJob, onStartNew } = props;
  const [pendingDelete, setPendingDelete] = useState<ClipJob | null>(null);
  if (jobs.length === 0) {
    return (
      <Card data-testid="clipper-job-list-empty" className="px-4 py-4">
        <EmptyState type="first-use" title="No jobs yet" description="Your recent clip jobs will appear here." />
      </Card>
    );
  }
  return (
    <section data-testid="clipper-job-list" aria-label="Recent jobs" className="flex flex-col gap-2">
      <h2 className="text-body font-semibold text-ink">Recent jobs</h2>
      <Card className="flex flex-col">
        {jobs.map((job) => (
          <div
            key={job.id}
            data-testid={`clipper-job-row-${job.id}`}
            className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 last:border-b-0"
          >
            <button
              type="button"
              data-testid={`clipper-job-select-${job.id}`}
              onClick={() => onSelectJob(job)}
              className="min-w-0 flex-1 text-left"
            >
              <span className="block truncate text-body font-medium text-ink">
                {job.sourceName}
                {activeJobId === job.id ? ' (active)' : ''}
              </span>
              <span className="block text-body text-ink-sub">
                {CLIP_STAGE_LABELS[job.status]}
                {job.clips.length > 0 ? ` · ${job.clips.length} ${job.clips.length === 1 ? 'clip' : 'clips'}` : ''}
                {job.status === 'failed' && job.error ? ` · ${job.error.message}` : ''}
              </span>
            </button>
            <div className="flex gap-2">
              {isRetryValid(job) && (
                <Button type="button" variant="outline" size="sm" data-testid={`clipper-job-retry-${job.id}`} onClick={() => onRetryJob(job)}>
                  Retry
                </Button>
              )}
              {job.status === 'failed' && !isRetryValid(job) && (
                <Button type="button" variant="outline" size="sm" data-testid={`clipper-job-new-${job.id}`} onClick={() => (onStartNew ? onStartNew() : onSelectJob(job))}>
                  Start new job
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" data-testid={`clipper-job-delete-${job.id}`} onClick={() => setPendingDelete(job)}>
                Delete
              </Button>
            </div>
          </div>
        ))}
      </Card>
      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this job?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the job&apos;s working files (audio, transcript, captions). Your exported clips and any
              Media Library items are never deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep job</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) onDeleteJob(pendingDelete);
                setPendingDelete(null);
              }}
            >
              Delete job
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
