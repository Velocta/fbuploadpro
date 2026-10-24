'use client';

import React from 'react';
import { NICHEFORGE_FAILURE_COPY, type NicheforgeRunRecord, type NicheforgeVideoStatus } from '@fbuploadpro/contracts';
import { Button } from '@/components/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/ui/card';
import { StatusDot, type Status } from '@/components/shared/ui/status-dot';

function videoDot(status: NicheforgeVideoStatus): { dot: Status; label: string } {
  switch (status) {
    case 'done':
      return { dot: 'operational', label: 'Done' };
    case 'failed':
      return { dot: 'critical', label: 'Failed' };
    case 'pending':
      return { dot: 'idle', label: 'Waiting' };
    case 'downloading':
      return { dot: 'queued', label: 'Downloading' };
    case 'downloaded':
      return { dot: 'queued', label: 'Downloaded' };
    case 'analysing':
      return { dot: 'queued', label: 'Analysing' };
    default:
      return { dot: 'idle', label: status };
  }
}

export interface RunProgressProps {
  run: NicheforgeRunRecord;
  onCancel: () => void;
}

export function RunProgress({ run, onCancel }: Readonly<RunProgressProps>) {
  const active = run.status === 'queued' || run.status === 'downloading' || run.status === 'analysing' || run.status === 'mining';
  const doneCount = run.videos.filter((v) => v.status === 'done').length;
  return (
    <Card data-testid="run-progress">
      <CardHeader>
        <CardTitle>Run progress — {run.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-body text-ink-sub" data-testid="run-progress-summary">
          {run.status} · {doneCount} of {run.videos.length} videos done
        </p>
        <ul className="flex flex-col gap-2">
          {run.videos.map((video) => {
            const meta = videoDot(video.status);
            return (
              <li key={video.id} className="flex flex-wrap items-center gap-2 border-t border-line pt-2" data-testid="run-progress-video">
                <span className="text-body text-ink">{video.metadata?.title ?? video.url}</span>
                <span className="text-metadata text-ink-sub">{video.platform}</span>
                <StatusDot status={meta.dot} label={meta.label} />
                {video.status === 'failed' && video.failureReason ? (
                  <span className="text-metadata text-ink-sub">
                    {video.failureDetail ?? NICHEFORGE_FAILURE_COPY[video.failureReason]}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
        {active ? (
          <div>
            <Button type="button" variant="outline" onClick={onCancel} data-testid="run-cancel">
              Cancel run
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
