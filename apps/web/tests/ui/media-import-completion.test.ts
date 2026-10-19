/**
 * @file media-import-completion.test.ts
 * @description Unit tests for import completion-state truthfulness (Spec 107:
 * H1 — the dialog must never report "Import complete" while a file is still
 * pending) and plain-language upload error mapping (C3).
 */

import { describe, it, expect } from 'vitest';
import {
  isBatchCompleted,
} from '@/components/media/media-import-utils';
import type { ImportQueueItem } from '@/components/media/media-types';
import { resolveUploadErrorMessage, StepTimeoutError } from '@/components/media/media-import-upload-engine';

function item(id: string, status: ImportQueueItem['status']): ImportQueueItem {
  return {
    id,
    file: new File(['x'], `${id}.mp4`, { type: 'video/mp4' }),
    name: `${id}.mp4`,
    size: 1024,
    mimeType: 'video/mp4',
    mediaType: 'video',
    destinationFolderId: null,
    status,
    progressPercent: status === 'completed' ? 100 : 42,
    isDuplicate: false,
    retryCount: 0,
  };
}

describe('isBatchCompleted (Spec 107 H1)', () => {
  it('is false while any item is still uploading', () => {
    const queue = [item('a', 'completed'), item('b', 'uploading')];
    expect(isBatchCompleted(queue, 'progress')).toBe(false);
  });

  it('is false while any item is still queued', () => {
    const queue = [item('a', 'completed'), item('b', 'queued')];
    expect(isBatchCompleted(queue, 'progress')).toBe(false);
  });

  it('is false while any item is paused — a paused file is still pending', () => {
    const queue = [item('a', 'completed'), item('b', 'paused')];
    expect(isBatchCompleted(queue, 'progress')).toBe(false);
  });

  it('is false when every item is paused', () => {
    const queue = [item('a', 'paused')];
    expect(isBatchCompleted(queue, 'progress')).toBe(false);
  });

  it('is true when all items reached a terminal state', () => {
    const queue = [item('a', 'completed'), item('b', 'failed'), item('c', 'cancelled')];
    expect(isBatchCompleted(queue, 'progress')).toBe(true);
  });

  it('is true when the whole batch was cancelled', () => {
    const queue = [item('a', 'cancelled'), item('b', 'cancelled')];
    expect(isBatchCompleted(queue, 'progress')).toBe(true);
  });

  it('is false with an empty queue or outside the progress step', () => {
    expect(isBatchCompleted([], 'progress')).toBe(false);
    expect(isBatchCompleted([item('a', 'completed')], 'staging')).toBe(false);
    expect(isBatchCompleted([item('a', 'completed')], 'complete')).toBe(false);
  });
});

describe('resolveUploadErrorMessage (Spec 107 C3)', () => {
  it('maps timeouts to plain language', () => {
    expect(resolveUploadErrorMessage(new StepTimeoutError('upload'))).toContain('timed out');
    expect(resolveUploadErrorMessage(new DOMException('x', 'AbortError'))).toContain('timed out');
  });

  it('maps network failures to plain language', () => {
    expect(resolveUploadErrorMessage(new TypeError('Failed to fetch'))).toContain(
      'Network error'
    );
    expect(resolveUploadErrorMessage(new Error('NetworkError when attempting to fetch resource.'))).toContain(
      'Network error'
    );
  });

  it('passes through messages already written in plain language', () => {
    const msg = "Upload finished but we couldn't save it to your library. Please try again.";
    expect(resolveUploadErrorMessage(new Error(msg))).toBe(msg);
  });

  it('falls back to a generic message for unknown values', () => {
    expect(resolveUploadErrorMessage(null)).toBe('Upload failed. Please try again.');
    expect(resolveUploadErrorMessage(undefined)).toBe('Upload failed. Please try again.');
  });
});
