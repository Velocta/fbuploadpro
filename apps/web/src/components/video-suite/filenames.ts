/**
 * Filename helpers (spec §4.1.4, §4.2.3). Pure functions, unit-tested.
 * Sanitisation mirrors the library's rule: path separators and
 * non-filename characters replaced, leading dots stripped, empty result
 * falls back to `download_<timestamp>`.
 */

// eslint-disable-next-line no-control-regex -- filename sanitisation must strip C0 controls.
const UNSAFE_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;

export function sanitizeFileName(raw: string): string {
  const cleaned = raw
    .replace(UNSAFE_CHARS, '_')
    .replace(/^\.+/, '')
    .replace(/\.+$/, '')
    .trim();
  if (cleaned === '' || cleaned === '.' || cleaned === '..') {
    return `download_${Date.now()}`;
  }
  // Cap at 200 chars (plus extension handled by callers) to stay well
  // inside filesystem limits; truncation keeps the tail readable.
  return cleaned.length > 200 ? cleaned.slice(0, 200) : cleaned;
}

export function splitStemExt(fileName: string): { stem: string; ext: string } {
  const idx = fileName.lastIndexOf('.');
  if (idx <= 0) return { stem: fileName, ext: '' };
  return { stem: fileName.slice(0, idx), ext: fileName.slice(idx + 1) };
}

/**
 * Non-overwrite naming (§4.2.3): append ` (2)`, ` (3)`, … before the
 * extension until the name is free. Deterministic and visible — the
 * completed row always displays the ACTUAL final filename.
 */
export function nextAvailableName(existing: ReadonlySet<string>, desired: string): string {
  if (!existing.has(desired)) return desired;
  const { stem, ext } = splitStemExt(desired);
  const suffix = ext === '' ? '' : `.${ext}`;
  let n = 2;
  for (;;) {
    const candidate = `${stem} (${n})${suffix}`;
    if (!existing.has(candidate)) return candidate;
    n += 1;
  }
}

/** Humanised size; exact bytes are shown on hover via the `title` attr. */
export function humanizeBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

/** Duration in seconds → `m:ss`; null/NaN renders as `—`, never fake `0:00`. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return '—';
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Parse a bridge resolution string ("1280x720", "audio only") into dims. */
export function parseResolutionString(resolution: string | null | undefined): { width: number | null; height: number | null } {
  if (!resolution) return { width: null, height: null };
  const match = /^(\d+)x(\d+)$/.exec(resolution.trim());
  if (!match) return { width: null, height: null };
  return { width: Number.parseInt(match[1], 10), height: Number.parseInt(match[2], 10) };
}
