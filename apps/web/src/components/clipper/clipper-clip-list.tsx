'use client';

import React from 'react';
import type { ClipSelection } from '@fbuploadpro/contracts';
import { Button, Card, EmptyState } from '@/components/shared/ui';
import { ClipperClipRow } from './clipper-clip-row';

export interface ClipperClipListProps {
  clips: ClipSelection[];
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  canSelect: boolean;
  onExport: () => void;
  exporting: boolean;
  onImport: (clip: ClipSelection) => void;
  importingClipId: string | null;
}

export function ClipperClipList(props: Readonly<ClipperClipListProps>) {
  const { clips, selectedIds, onSelectedIdsChange, canSelect, onExport, exporting, onImport, importingClipId } = props;
  if (clips.length === 0) {
    return (
      <Card data-testid="clipper-clip-list-empty" className="px-4 py-4">
        <EmptyState type="first-use" title="No clips yet" description="Run a job and its clips will appear here." />
      </Card>
    );
  }
  return (
    <section data-testid="clipper-clip-list" aria-label="Suggested clips" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-body font-semibold text-ink">
          Suggested clips ({clips.length})
        </h2>
        {canSelect && (
          <Button
            type="button"
            data-testid="clipper-export-btn"
            onClick={onExport}
            disabled={exporting || selectedIds.length === 0}
          >
            {exporting ? 'Exporting…' : `Export ${selectedIds.length} ${selectedIds.length === 1 ? 'clip' : 'clips'}`}
          </Button>
        )}
      </div>
      <Card className="flex flex-col">
        {clips.map((clip, i) => (
          <ClipperClipRow
            key={clip.id}
            clip={clip}
            index={i}
            selected={selectedIds.includes(clip.id)}
            canSelect={canSelect}
            onSelectedChange={(selected) =>
              onSelectedIdsChange(
                selected ? [...selectedIds, clip.id] : selectedIds.filter((id) => id !== clip.id),
              )
            }
            onImport={onImport}
            importing={importingClipId === clip.id}
          />
        ))}
      </Card>
      {canSelect && (
        <p className="text-body text-ink-sub">
          Untick clips you do not want. Nothing exports until you press Export.
        </p>
      )}
    </section>
  );
}
