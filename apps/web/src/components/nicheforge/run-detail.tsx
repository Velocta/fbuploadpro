'use client';

import React from 'react';
import { NICHEFORGE_FAILURE_COPY, type NicheforgeRunRecord } from '@fbuploadpro/contracts';
import { Button } from '@/components/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/ui/card';
import { StatusDot } from '@/components/shared/ui/status-dot';
import type { NicheforgeBridge } from '@/lib/nicheforge/bridge-adapter';
import { ReportView } from './report-view';
import { runStatusDot } from './runs-list';

export interface RunDetailProps {
  run: NicheforgeRunRecord;
  bridge: NicheforgeBridge;
  onDelete: (id: string) => void;
  onReRun: (run: NicheforgeRunRecord) => void;
}

export function RunDetail({ run, bridge, onDelete, onReRun }: Readonly<RunDetailProps>) {
  const meta = runStatusDot(run.status);
  return (
    <Card data-testid="run-detail">
      <CardHeader>
        <CardTitle>{run.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusDot status={meta.dot} label={meta.label} />
          <span className="text-metadata text-ink-sub">
            {run.provider} · {run.modelId} · prompt v{run.promptVersion}
          </span>
          <span className="text-metadata text-ink-sub">
            Created {new Date(run.createdAt).toLocaleString()}
            {run.completedAt ? ` · Completed ${new Date(run.completedAt).toLocaleString()}` : ''}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => onReRun(run)} data-testid="run-rerun">
            Re-run with the same links
          </Button>
          <Button type="button" variant="outline" onClick={() => onDelete(run.id)} data-testid="run-delete">
            Delete run
          </Button>
        </div>
        {run.videos.map((video) => {
          const title = video.metadata?.title ?? video.url;
          const breakdown = video.breakdown;
          return (
            <section key={video.id} className="flex flex-col gap-2 border-t border-line pt-3" data-testid="run-video-card">
              <h3 className="text-body font-semibold text-ink">{title}</h3>
              <p className="text-metadata text-ink-sub">
                {video.platform}
                {video.metadata?.channel ? ` · ${video.metadata.channel}` : ''}
                {video.metadata ? ` · ${video.metadata.durationSeconds}s` : ''}
                {breakdown?.transcriptAvailable ? ' · With captions' : ' · No captions'}
              </p>
              {video.status === 'failed' ? (
                <p className="text-body text-ink-sub" data-testid="run-video-failure">
                  {video.failureDetail ?? (video.failureReason ? NICHEFORGE_FAILURE_COPY[video.failureReason] : 'Failed.')}
                </p>
              ) : null}
              {breakdown ? (
                <div className="flex flex-col gap-2" data-testid="run-video-breakdown">
                  <p className="text-body text-ink">
                    Hook ({breakdown.hookType}): {breakdown.hook}
                  </p>
                  <p className="text-body text-ink-sub">Structure:</p>
                  <ul className="flex flex-col gap-1">
                    {breakdown.structure.map((beat) => (
                      <li key={beat} className="text-body text-ink-sub">
                        - {beat}
                      </li>
                    ))}
                  </ul>
                  <p className="text-body text-ink-sub">Pacing: {breakdown.pacing}</p>
                  <p className="text-body text-ink-sub">
                    Topic: {breakdown.topic} · Format: {breakdown.format}
                  </p>
                  <p className="text-body text-ink-sub">Why it worked: {breakdown.whyItWorked}</p>
                  <p className="text-body text-ink-sub">Replicable takeaways:</p>
                  <ul className="flex flex-col gap-1">
                    {breakdown.replicableTakeaways.map((item) => (
                      <li key={item} className="text-body text-ink-sub">
                        - {item}
                      </li>
                    ))}
                  </ul>
                  <p className="text-metadata text-ink-sub" data-testid="run-video-confidence">
                    {breakdown.transcriptAvailable
                      ? `Confidence: ${breakdown.confidence} — ${breakdown.confidenceReason}`
                      : 'Confidence: low — no captions were available for this video, so this breakdown is from title and details only.'}
                  </p>
                </div>
              ) : null}
            </section>
          );
        })}
        <ReportView run={run} bridge={bridge} />
      </CardContent>
    </Card>
  );
}
