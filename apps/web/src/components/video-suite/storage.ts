/**
 * localStorage persistence (spec §4.6). One namespaced key; corrupt
 * entries are dropped individually with a console warning, never a
 * crash, never a wipe of the whole key.
 */
import type { ConversionJob, DownloadJob } from '@fbuploadpro/contracts';
import {
  markStaleConversionJobsOnLoad,
  markStaleDownloadJobsOnLoad,
  parsePersistedConversionJob,
  parsePersistedDownloadJob,
} from './job-machines';

export const VIDEO_SUITE_STORAGE_KEY = 'fbuploadpro.video-suite.jobs.v1';
export const VIDEO_SUITE_FOLDER_KEY = 'fbuploadpro.video-suite.folder.v1';
export const VIDEO_SUITE_CONVERTER_KEY = 'fbuploadpro.video-suite.converter.v1';

export interface PersistedJobs {
  downloads: DownloadJob[];
  conversions: ConversionJob[];
}

export interface FolderPreference {
  scopeId: string;
  path: string;
}

export function loadJobs(): PersistedJobs {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return { downloads: [], conversions: [] };
  }
  try {
    const raw = window.localStorage.getItem(VIDEO_SUITE_STORAGE_KEY);
    if (!raw) return { downloads: [], conversions: [] };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { downloads: [], conversions: [] };
    const record = parsed as { downloads?: unknown; conversions?: unknown };
    const downloads = Array.isArray(record.downloads)
      ? record.downloads.flatMap((entry) => {
          const job = parsePersistedDownloadJob(entry);
          if (job === null) {
            console.warn('[video-suite] Dropping unparseable persisted download job.');
            return [];
          }
          return [job];
        })
      : [];
    const conversions = Array.isArray(record.conversions)
      ? record.conversions.flatMap((entry) => {
          const job = parsePersistedConversionJob(entry);
          if (job === null) {
            console.warn('[video-suite] Dropping unparseable persisted conversion job.');
            return [];
          }
          return [job];
        })
      : [];
    return {
      downloads: markStaleDownloadJobsOnLoad(downloads),
      conversions: markStaleConversionJobsOnLoad(conversions),
    };
  } catch {
    console.warn('[video-suite] Stored job history was unreadable; starting fresh.');
    return { downloads: [], conversions: [] };
  }
}

export function saveJobs(jobs: PersistedJobs): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;
  try {
    window.localStorage.setItem(VIDEO_SUITE_STORAGE_KEY, JSON.stringify(jobs));
  } catch {
    // Quota or private mode: history is best-effort, never a crash.
    console.warn('[video-suite] Could not persist job history.');
  }
}

export function loadFolderPreference(): FolderPreference | null {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(VIDEO_SUITE_FOLDER_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      const record = parsed as { scopeId?: unknown; path?: unknown };
      if (typeof record.scopeId === 'string' && typeof record.path === 'string') {
        return { scopeId: record.scopeId, path: record.path };
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function saveFolderPreference(pref: FolderPreference): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;
  try {
    window.localStorage.setItem(VIDEO_SUITE_FOLDER_KEY, JSON.stringify(pref));
  } catch {
    console.warn('[video-suite] Could not persist folder preference.');
  }
}
