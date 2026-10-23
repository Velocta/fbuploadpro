/**
 * Typed preferences helper (spec 137 §3.9) — the only sanctioned way
 * to persist device preferences.
 *
 * Device preferences (theme, sidebar state, view preferences) are the
 * one class of data allowed in web storage. Everything stored here is
 * untrusted input — a user, an extension, or an older build may have
 * written anything — so every read is validated through the
 * preference's zod schema and every failure resolves to the typed
 * default. Reads NEVER throw into render; writes validate first and
 * report success as a boolean (a full/blocked store is not fatal).
 *
 * Keys are namespaced (`fbup:pref:<name>`) and come from the typed
 * registry below — call sites pass a definition, never a string
 * literal key. Values are stored as JSON; reads also accept the
 * legacy plain-string form so preferences written by older builds
 * survive the migration of each call site (owned by the surfaces,
 * spec §3.9).
 */

import { z } from 'zod';

const STORAGE_NAMESPACE = 'fbup:pref:';

export interface PreferenceDefinition<T> {
  /** Registry name, e.g. `media-view-mode`. */
  name: string;
  /** Full namespaced storage key. */
  storageKey: string;
  schema: z.ZodType<T>;
  defaultValue: T;
}

export function definePreference<T>(
  name: string,
  schema: z.ZodType<T>,
  defaultValue: T
): PreferenceDefinition<T> {
  return {
    name,
    storageKey: `${STORAGE_NAMESPACE}${name}`,
    schema,
    defaultValue,
  };
}

/** The typed key registry — every preference the app persists. */
export const preferences = {
  theme: definePreference('theme', z.enum(['dark', 'light']), 'dark'),
  mediaViewMode: definePreference(
    'media-view-mode',
    z.enum(['grid', 'table']),
    'grid'
  ),
  sidebarState: definePreference(
    'sidebar-state',
    z.enum(['expanded', 'collapsed']),
    'expanded'
  ),
} as const;

export type PreferenceName = keyof typeof preferences;

/** Per-page content-checklist dismissal (a device preference, spec §3.9). */
export function contentChecklistDismissedPreference(
  pageId: string
): PreferenceDefinition<boolean> {
  return definePreference(
    `content-checklist-dismissed:${pageId}`,
    z.boolean(),
    false
  );
}

function resolveStorage(custom?: Storage): Storage | null {
  if (custom) return custom;
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch (error) {
    console.warn('[preferences] storage is unavailable', error);
    return null;
  }
}

/**
 * Read a preference, zod-validated. Corrupt, missing, or unreadable
 * stored data resolves to the definition's default — never a throw.
 */
export function getPreference<T>(
  definition: PreferenceDefinition<T>,
  storage?: Storage
): T {
  const store = resolveStorage(storage);
  if (!store) return definition.defaultValue;

  let raw: string | null;
  try {
    raw = store.getItem(definition.storageKey);
  } catch (error) {
    console.warn('[preferences] read failed', error);
    return definition.defaultValue;
  }
  if (raw === null) return definition.defaultValue;

  let parsedValue: unknown;
  let parsedOk = false;
  try {
    parsedValue = JSON.parse(raw) as unknown;
    parsedOk = true;
  } catch {
    parsedOk = false;
  }
  if (parsedOk) {
    const result = definition.schema.safeParse(parsedValue);
    if (result.success) return result.data;
  }

  // Legacy form: older builds stored plain strings (e.g. `dark`, `grid`).
  const legacy = definition.schema.safeParse(raw);
  if (legacy.success) return legacy.data;

  return definition.defaultValue;
}

/**
 * Write a preference, zod-validated. An invalid value is a programmer
 * error and throws; an unavailable/full store returns `false`.
 */
export function setPreference<T>(
  definition: PreferenceDefinition<T>,
  value: T,
  storage?: Storage
): boolean {
  const result = definition.schema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `Invalid value for preference "${definition.name}": ${result.error.issues
        .map((issue) => issue.message)
        .join('; ')}`
    );
  }
  const store = resolveStorage(storage);
  if (!store) return false;
  try {
    store.setItem(definition.storageKey, JSON.stringify(result.data));
    return true;
  } catch (error) {
    console.warn('[preferences] write failed', error);
    return false;
  }
}

/** Remove a preference. Returns `false` when storage is unavailable. */
export function removePreference<T>(
  definition: PreferenceDefinition<T>,
  storage?: Storage
): boolean {
  const store = resolveStorage(storage);
  if (!store) return false;
  try {
    store.removeItem(definition.storageKey);
    return true;
  } catch (error) {
    console.warn('[preferences] remove failed', error);
    return false;
  }
}
