'use client';

import React from 'react';
import type { NicheforgeRunIndexEntry, NicheforgeRunStatus } from '@fbuploadpro/contracts';
import { Button } from '@/components/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/ui/card';
import { EmptyState } from '@/components/shared/ui/empty-state';
import { Input } from '@/components/shared/ui/input';
import { StatusDot, type Status } from '@/components/shared/ui/status-dot';

export function runStatusDot(status: NicheforgeRunStatus): { dot: Status; label: string } {
  switch (status) {
    case 'done':
      return { dot: 'operational', label: 'Done' };
    case 'failed':
      return { dot: 'critical', label: 'Failed' };
    case 'cancelled':
      return { dot: 'critical', label: 'Cancelled' };
    case 'interrupted':
      return { dot: 'critical', label: 'Interrupted' };
    case 'queued':
      return { dot: 'queued', label: 'Queued' };
    case 'downloading':
      return { dot: 'queued', label: 'Downloading' };
    case 'analysing':
      return { dot: 'queued', label: 'Analysing' };
    case 'mining':
      return { dot: 'queued', label: 'Mining patterns' };
    default:
      return { dot: 'idle', label: status };
  }
}

export interface RunsListProps {
  entries: NicheforgeRunIndexEntry[];
  search: string;
  onSearchChange: (value: string) => void;
  selectedId: string | null;
  damagedIds: Set<string>;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onStartNew: () => void;
}

export function RunsList({ entries, search, onSearchChange, selectedId, damagedIds, onSelect, onDelete, onStartNew }: Readonly<RunsListProps>) {
  return (
    <Card data-testid="runs-list">
      <CardHeader>
        <CardTitle>Research runs</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Input
          data-testid="runs-search"
          placeholder="Search research by title"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search research by title"
        />
        {entries.length === 0 ? (
          <EmptyState
            type="cleared"
            title="No research yet"
            description="Paste video links above and press Analyse to study what makes them work."
            action={<Button onClick={onStartNew}>Start a run</Button>}
            data-testid="runs-empty"
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {entries.map((entry) => {
              const meta = runStatusDot(entry.status);
              const damaged = damagedIds.has(entry.id);
              return (
                <li key={entry.id} className="border-t border-line pt-2" data-testid="run-row">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSelect(entry.id)}
                      className="text-left text-body font-medium text-ink underline-offset-2 hover:underline"
                      data-testid="run-row-open"
                    >
                      {entry.title}
                    </button>
                    {damaged ? (
                      <span className="text-metadata text-signal-critical">Damaged run</span>
                    ) : (
                      <StatusDot status={meta.dot} label={meta.label} />
                    )}
                    <span className="text-metadata text-ink-sub">
                      {entry.successCount} of {entry.videoCount} analysed ·{' '}
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </span>
                    <span className="ml-auto flex gap-1">
                      {selectedId === entry.id ? null : (
                        <Button type="button" variant="outline" size="sm" onClick={() => onSelect(entry.id)}>
                          Open
                        </Button>
                      )}
                      <Button type="button" variant="outline" size="sm" onClick={() => onDelete(entry.id)} data-testid="run-row-delete">
                        Delete
                      </Button>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
