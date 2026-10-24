import { describe, expect, it, beforeEach } from 'vitest';
import { VIDEO_SUITE_FOLDER_KEY, VIDEO_SUITE_STORAGE_KEY, loadFolderPreference, loadJobs, saveFolderPreference, saveJobs } from './storage';
import type { DownloadJob } from '@fbuploadpro/contracts';

function job(overrides: Partial<DownloadJob> = {}): DownloadJob {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    url: 'https://example.com/watch?v=1',
    title: 'Test',
    choice: { kind: 'preset', preset: 'best' },
    destinationFolder: '/tmp/videos',
    fileName: 'Test',
    status: 'queued',
    progress: null,
    errorCode: null,
    errorDetail: null,
    finalPath: null,
    finalSizeBytes: null,
    note: null,
    createdAt: '2026-10-24T00:00:00.000Z',
    updatedAt: '2026-10-24T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('job persistence', () => {
  it('round-trips jobs and re-marks stale running jobs on load', () => {
    saveJobs({ downloads: [job({ status: 'downloading' }), job({ id: '33333333-3333-4333-8333-333333333333', status: 'completed' })], conversions: [] });
    const loaded = loadJobs();
    expect(loaded.downloads[0].status).toBe('failed');
    expect(loaded.downloads[0].errorCode).toBe('unknown');
    expect(loaded.downloads[1].status).toBe('completed');
  });
  it('drops corrupt entries individually, keeping the good ones', () => {
    window.localStorage.setItem(
      VIDEO_SUITE_STORAGE_KEY,
      JSON.stringify({ downloads: [job(), { ...job(), status: 'fetching' }, 'garbage'], conversions: [] }),
    );
    const loaded = loadJobs();
    expect(loaded.downloads).toHaveLength(1);
    expect(loaded.downloads[0].id).toBe(job().id);
  });
  it('unreadable storage starts fresh instead of crashing', () => {
    window.localStorage.setItem(VIDEO_SUITE_STORAGE_KEY, '{not json');
    expect(loadJobs()).toEqual({ downloads: [], conversions: [] });
  });
  it('persists and restores the folder preference', () => {
    expect(loadFolderPreference()).toBeNull();
    saveFolderPreference({ scopeId: 'scope-1', path: '/tmp/videos' });
    expect(loadFolderPreference()).toEqual({ scopeId: 'scope-1', path: '/tmp/videos' });
    window.localStorage.setItem(VIDEO_SUITE_FOLDER_KEY, JSON.stringify({ scopeId: 42, path: '/tmp' }));
    expect(loadFolderPreference()).toBeNull();
  });
});
