import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  contentChecklistDismissedPreference,
  definePreference,
  getPreference,
  preferences,
  removePreference,
  setPreference,
} from '@/lib/storage/preferences';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: vi.fn((key: string) => map.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      map.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      map.delete(key);
    }),
  } as unknown as Storage & { map: Map<string, string> };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('preference registry (spec 137 §3.9)', () => {
  it('namespaces every storage key and exposes typed defaults', () => {
    expect(preferences.theme.storageKey).toBe('fbup:pref:theme');
    expect(preferences.theme.defaultValue).toBe('dark');
    expect(preferences.mediaViewMode.storageKey).toBe('fbup:pref:media-view-mode');
    expect(preferences.mediaViewMode.defaultValue).toBe('grid');
    expect(preferences.sidebarState.storageKey).toBe('fbup:pref:sidebar-state');
    expect(preferences.sidebarState.defaultValue).toBe('expanded');
  });

  it('builds per-page definitions for the checklist dismissal', () => {
    const def = contentChecklistDismissedPreference('page-9');
    expect(def.storageKey).toBe('fbup:pref:content-checklist-dismissed:page-9');
    expect(def.defaultValue).toBe(false);
  });

  it('definePreference composes name, key, schema, and default', () => {
    const def = definePreference('volume', z.number().min(0).max(10), 5);
    expect(def.name).toBe('volume');
    expect(def.storageKey).toBe('fbup:pref:volume');
    expect(def.defaultValue).toBe(5);
  });
});

describe('getPreference', () => {
  it('returns the default when nothing is stored', () => {
    expect(getPreference(preferences.theme, fakeStorage())).toBe('dark');
  });

  it('returns a stored JSON value that passes validation', () => {
    const storage = fakeStorage({ 'fbup:pref:theme': JSON.stringify('light') });
    expect(getPreference(preferences.theme, storage)).toBe('light');
  });

  it('accepts the legacy plain-string form written by older builds', () => {
    const storage = fakeStorage({ 'fbup:pref:media-view-mode': 'table' });
    expect(getPreference(preferences.mediaViewMode, storage)).toBe('table');
  });

  it('returns the validated default for corrupt stored JSON — never throws', () => {
    const storage = fakeStorage({ 'fbup:pref:theme': '{corrupt' });
    expect(() => getPreference(preferences.theme, storage)).not.toThrow();
    expect(getPreference(preferences.theme, storage)).toBe('dark');
  });

  it('returns the default when the stored value fails the schema', () => {
    const storage = fakeStorage({ 'fbup:pref:theme': JSON.stringify('blue') });
    expect(getPreference(preferences.theme, storage)).toBe('dark');
    const boolStorage = fakeStorage({
      'fbup:pref:content-checklist-dismissed:p1': '1',
    });
    expect(getPreference(contentChecklistDismissedPreference('p1'), boolStorage)).toBe(false);
  });

  it('returns the default when storage reads throw (blocked/private mode)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const storage = {
      getItem: vi.fn(() => {
        throw new Error('blocked');
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    } as unknown as Storage;
    expect(getPreference(preferences.theme, storage)).toBe('dark');
  });

  it('round-trips structured values through JSON', () => {
    const def = definePreference(
      'filters',
      z.object({ mediaType: z.string(), ratio: z.string() }),
      { mediaType: 'all', ratio: 'all' }
    );
    const storage = fakeStorage();
    expect(setPreference(def, { mediaType: 'video', ratio: '16:9' }, storage)).toBe(true);
    expect(getPreference(def, storage)).toEqual({ mediaType: 'video', ratio: '16:9' });
    expect(storage.map.get('fbup:pref:filters')).toBe(
      JSON.stringify({ mediaType: 'video', ratio: '16:9' })
    );
  });
});

describe('setPreference', () => {
  it('writes JSON under the namespaced key', () => {
    const storage = fakeStorage();
    expect(setPreference(preferences.sidebarState, 'collapsed', storage)).toBe(true);
    expect(storage.map.get('fbup:pref:sidebar-state')).toBe('"collapsed"');
  });

  it('throws on a schema-invalid value (programmer error, not a storage failure)', () => {
    const storage = fakeStorage();
    expect(() =>
      setPreference(preferences.theme, 'blue' as 'dark', storage)
    ).toThrow('Invalid value for preference "theme"');
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('returns false instead of throwing when the write itself fails', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        throw new Error('quota');
      }),
      removeItem: vi.fn(),
    } as unknown as Storage;
    expect(setPreference(preferences.theme, 'light', storage)).toBe(false);
  });
});

describe('removePreference', () => {
  it('removes the key so reads fall back to the default', () => {
    const storage = fakeStorage({ 'fbup:pref:theme': '"light"' });
    expect(removePreference(preferences.theme, storage)).toBe(true);
    expect(getPreference(preferences.theme, storage)).toBe('dark');
  });

  it('returns false when removal throws', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(() => {
        throw new Error('blocked');
      }),
    } as unknown as Storage;
    expect(removePreference(preferences.theme, storage)).toBe(false);
  });
});

describe('storage resolution', () => {
  it('uses the ambient storage when no storage is injected', () => {
    const ambient = fakeStorage({ 'fbup:pref:theme': '"light"' });
    vi.stubGlobal('localStorage', ambient);
    expect(getPreference(preferences.theme)).toBe('light');
    expect(setPreference(preferences.theme, 'dark')).toBe(true);
    expect(ambient.map.get('fbup:pref:theme')).toBe('"dark"');
    expect(removePreference(preferences.theme)).toBe(true);
  });

  it('resolves to defaults / false when no storage exists (server render)', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(getPreference(preferences.theme)).toBe('dark');
    expect(setPreference(preferences.theme, 'light')).toBe(false);
    expect(removePreference(preferences.theme)).toBe(false);
  });

  it('survives an ambient storage accessor that throws', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('denied');
      },
    });
    try {
      expect(getPreference(preferences.theme)).toBe('dark');
      expect(setPreference(preferences.theme, 'light')).toBe(false);
      expect(removePreference(preferences.theme)).toBe(false);
    } finally {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });
});
