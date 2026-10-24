'use client';

import React from 'react';
import { VIDEO_SUITE_ERROR_MESSAGES, type ConversionJob, type DownloadJob } from '@fbuploadpro/contracts';
import { Button } from '@/components/shared/ui/button';
import { StatusDot } from '@/components/shared/ui/status-dot';
import { humanizeBytes } from './filenames';

/**
 * One job-list visual pattern for downloads and conversions (§4.5), so
 * progress/cancel affordances are unambiguous. Progress shows percent
 * only when known; otherwise an indeterminate state with the phase —
 * never a fabricated percent. Errors never appear only as a toast and
 * never auto-dismiss; every failed row keeps a Retry action.
 * (No progress bar primitive exists in shared/ui — the design-system
 * rule forbids a surface-local bar, so progress is text + StatusDot.
 * A Progress primitive extension is a coordinator decision.)
 */

function progressText(job: DownloadJob | ConversionJob): string {
  const progress = job.progress;
  if (job.status === 'queued') return 'Queued';
  if (job.status === 'postprocessing') return 'Finishing up…';
  if (progress?.percent !== null && progress?.percent !== undefined) return `${Math.round(progress.percent)}%`;
  if (job.status === 'downloading' || job.status === 'converting') return 'In progress…';
  return '';
}

function statusFor(job: DownloadJob | ConversionJob): { status: 'operational' | 'queued' | 'critical' | 'idle'; label: string } {
  if (job.status === 'completed') return { status: 'operational', label: 'Completed' };
  if (job.status === 'failed') return { status: 'critical', label: 'Failed' };
  if (job.status === 'cancelled') return { status: 'idle', label: 'Cancelled' };
  if (job.status === 'queued') return { status: 'queued', label: 'Queued' };
  return { status: 'operational', label: 'Running' };
}

export function DownloadJobRow({
  job,
  onCancel,
  onRetry,
}: {
  job: DownloadJob;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const terminal = job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled';
  const finalName = job.finalPath !== null ? job.finalPath.split('/').pop() ?? job.fileName : job.fileName;
  return (
    <li data-testid="download-job-row" className="flex flex-col gap-1 border-b border-line px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <StatusDot status={statusFor(job).status} label={statusFor(job).label} />
        <span className="min-w-0 flex-1 truncate font-medium text-ink">{job.title ?? job.fileName}</span>
        <span className="text-body text-ink-sub">{progressText(job)}</span>
      </div>
      <p className="truncate text-body text-ink-sub" title={job.finalPath ?? job.fileName}>
        {job.status === 'completed' ? finalName : job.url}
        {job.finalSizeBytes !== null ? ` · ${humanizeBytes(job.finalSizeBytes)}` : null}
        {job.note ? ` · ${job.note}` : null}
      </p>
      {job.status === 'failed' && job.errorCode !== null ? (
        <div>
          <p role="alert" className="text-body text-ink">
            {VIDEO_SUITE_ERROR_MESSAGES[job.errorCode]}
          </p>
          {job.errorDetail ? (
            <details className="text-body text-ink-sub">
              <summary>Show details</summary>
              <p className="break-words">{job.errorDetail}</p>
            </details>
          ) : null}
        </div>
      ) : null}
      {job.status === 'cancelled' ? <p className="text-body text-ink-sub">Cancelled.</p> : null}
      <div className="flex gap-2">
        {!terminal ? (
          <Button variant="secondary" size="sm" onClick={() => onCancel(job.id)}>
            Cancel
          </Button>
        ) : null}
        {job.status === 'failed' ? (
          <Button variant="secondary" size="sm" onClick={() => onRetry(job.id)}>
            Retry
          </Button>
        ) : null}
      </div>
    </li>
  );
}

export function ConversionJobRow({
  job,
  onCancel,
  onRetry,
}: {
  job: ConversionJob;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const terminal = job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled';
  const finalName = job.finalPath !== null ? job.finalPath.split('/').pop() ?? job.outputFileName : job.outputFileName;
  return (
    <li data-testid="conversion-job-row" className="flex flex-col gap-1 border-b border-line px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <StatusDot status={statusFor(job).status} label={statusFor(job).label} />
        <span className="min-w-0 flex-1 truncate font-medium text-ink">{job.sourceName}</span>
        <span className="text-body text-ink-sub">{progressText(job)}</span>
      </div>
      <p className="truncate text-body text-ink-sub">
        {job.target.toUpperCase()} · {job.resolution} · {job.quality}
        {job.status === 'completed' ? ` · ${finalName}` : null}
        {job.finalSizeBytes !== null ? ` · ${humanizeBytes(job.finalSizeBytes)}` : null}
        {job.note ? ` · ${job.note}` : null}
      </p>
      {job.status === 'failed' && job.errorCode !== null ? (
        <div>
          <p role="alert" className="text-body text-ink">
            {VIDEO_SUITE_ERROR_MESSAGES[job.errorCode]}
          </p>
          {job.errorDetail ? (
            <details className="text-body text-ink-sub">
              <summary>Show details</summary>
              <p className="break-words">{job.errorDetail}</p>
            </details>
          ) : null}
        </div>
      ) : null}
      {job.status === 'cancelled' ? <p className="text-body text-ink-sub">Cancelled.</p> : null}
      <div className="flex gap-2">
        {!terminal ? (
          <Button variant="secondary" size="sm" onClick={() => onCancel(job.id)}>
            Cancel
          </Button>
        ) : null}
        {job.status === 'failed' ? (
          <Button variant="secondary" size="sm" onClick={() => onRetry(job.id)}>
            Retry
          </Button>
        ) : null}
      </div>
    </li>
  );
}
