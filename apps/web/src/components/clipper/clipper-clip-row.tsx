'use client';

import React from 'react';
import { CLIP_REASON_LABELS, type ClipSelection } from '@fbuploadpro/contracts';
import { Button, Checkbox, StatusDot, Tag } from '@/components/shared/ui';
import { clipFileName } from './clipper-captions';

export interface ClipperClipRowProps {
  clip: ClipSelection;
  index: number;
  selected: boolean;
  canSelect: boolean;
  onSelectedChange?: (selected: boolean) => void;
  onImport?: (clip: ClipSelection) => void;
  importing?: boolean;
}

const EXPORT_STATUS_DOT: Record<ClipSelection['exportStatus'], 'operational' | 'queued' | 'critical' | 'idle'> = {
  pending: 'idle',
  exporting: 'queued',
  exported: 'operational',
  failed: 'critical',
};

const EXPORT_STATUS_LABEL: Record<ClipSelection['exportStatus'], string> = {
  pending: 'Not exported yet',
  exporting: 'Exporting',
  exported: 'Exported',
  failed: 'Export failed',
};

function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * One clip row: duration, transcript excerpt, reason Tags (enum only),
 * export StatusDot, pre-export deselect checkbox, post-import link.
 * Importing twice deliberately creates a second library item (spec
 * OD-148-7) — the button stays available and reads "Import again".
 */
export function ClipperClipRow(props: Readonly<ClipperClipRowProps>) {
  const { clip, index, selected, canSelect, onSelectedChange, onImport, importing } = props;
  return (
    <article data-testid={`clipper-clip-row-${clip.id}`} className="flex flex-col gap-2 border-b border-line px-4 py-3 last:border-b-0">
      <div className="flex items-start gap-3">
        {canSelect && onSelectedChange && (
          <Checkbox
            data-testid={`clipper-clip-select-${clip.id}`}
            checked={selected}
            onCheckedChange={(v) => onSelectedChange(v === true)}
            aria-label={`Select clip ${index + 1} for export`}
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-body font-medium text-ink">Clip {index + 1}</span>
            <span data-testid={`clipper-clip-duration-${clip.id}`} className="text-body tabular-nums text-ink-sub">
              {formatDuration(clip.durationSeconds)}
            </span>
            <StatusDot status={EXPORT_STATUS_DOT[clip.exportStatus]} label={EXPORT_STATUS_LABEL[clip.exportStatus]} />
          </div>
          <p data-testid={`clipper-clip-excerpt-${clip.id}`} className="text-body text-ink">
            {clip.excerpt}
          </p>
          <div className="flex flex-wrap gap-1">
            {clip.reasons.map((reason) => (
              <Tag key={reason} data-testid={`clipper-clip-reason-${clip.id}-${reason}`}>
                {CLIP_REASON_LABELS[reason]}
              </Tag>
            ))}
            {clip.aiRanked && <Tag data-testid={`clipper-clip-ai-${clip.id}`}>AI ranked</Tag>}
          </div>
          {clip.aiRanked && clip.aiReason && (
            <p className="text-body text-ink-sub">AI: {clip.aiReason}</p>
          )}
          {clip.exportStatus === 'exported' && (
            <p className="text-body text-ink-sub">{clipFileName(index + 1, clip.excerpt)}</p>
          )}
        </div>
      </div>
      {clip.exportStatus === 'exported' && onImport && (
        <div className="flex flex-wrap items-center gap-2 pl-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid={`clipper-import-btn-${clip.id}`}
            onClick={() => onImport(clip)}
            disabled={importing}
          >
            {clip.importedMediaId ? 'Import again' : 'Import into library'}
          </Button>
          {clip.importedMediaId && (
            <span data-testid={`clipper-imported-label-${clip.id}`} className="text-body text-ink-sub">
              Imported — view it in Media Library
            </span>
          )}
        </div>
      )}
    </article>
  );
}
