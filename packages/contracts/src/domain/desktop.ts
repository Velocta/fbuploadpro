import { z } from 'zod';

export const DesktopWindowActionEnum = z.enum([
  'minimize',
  'maximize',
  'unmaximize',
  'toggle_maximize',
  'close',
]);
export type DesktopWindowAction = z.infer<typeof DesktopWindowActionEnum>;

export const DesktopShellConfigSchema = z.object({
  appName: z.string(),
  version: z.string(),
  userAgent: z.string(),
  frameless: z.boolean(),
  defaultWidth: z.number().int().positive(),
  defaultHeight: z.number().int().positive(),
  minWidth: z.number().int().positive(),
  minHeight: z.number().int().positive(),
});
export type DesktopShellConfig = z.infer<typeof DesktopShellConfigSchema>;

/**
 * Checks whether the current execution context is running inside the FBUploadPro desktop shell (Tauri).
 */
export function isDesktopApp(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as unknown as Record<string, unknown>;
  const hasTauriInternals = Boolean(win.__TAURI_INTERNALS__ || win.__TAURI__);
  const hasDesktopUserAgent = Boolean(
    typeof navigator !== 'undefined' &&
    navigator?.userAgent?.includes('FBUploadProDesktop')
  );
  return hasTauriInternals || hasDesktopUserAgent;
}

/**
 * Checks whether the desktop client is running on macOS.
 */
export function isMacDesktop(): boolean {
  if (typeof navigator === 'undefined') return false;
  const platform = (navigator as any)?.userAgentData?.platform || navigator.platform || navigator.userAgent || '';
  return /Mac|iPhone|iPod|iPad/i.test(platform);
}

/**
 * Object responses for the two legacy bare-shape commands (spec 145 §7.3).
 * These types live here (not in desktop-bridge.ts) to avoid a circular import:
 * desktop-bridge.ts imports DesktopWindowActionEnum from this module.
 * NOTE: the legacy helpers keep their false-on-failure behaviour (spec §6.1
 * exception); only their success shape changed from a bare string to an object.
 */
export interface DesktopWindowActionResult {
  action: DesktopWindowAction;
  applied: true;
  maximized: boolean | null;
}
export interface DesktopOpenExternalUrlResult {
  opened: true;
  url: string;
}

/**
 * Safely dispatches a window management action to the native Tauri Rust backend.
 * Returns the §7.3 object on success, false in non-desktop environments or on
 * failure (legacy behaviour, retained for existing callers).
 */
export async function sendDesktopWindowAction(
  action: DesktopWindowAction,
): Promise<DesktopWindowActionResult | false> {
  if (!isDesktopApp()) return false;
  try {
    const win = typeof window !== 'undefined' ? (window as any) : undefined;
    if (win?.__TAURI_INTERNALS__?.invoke) {
      return (await win.__TAURI_INTERNALS__.invoke('handle_window_action', { action })) as DesktopWindowActionResult;
    }
    if (win?.__TAURI__?.core?.invoke) {
      return (await win.__TAURI__.core.invoke('handle_window_action', { action })) as DesktopWindowActionResult;
    }
    return false;
  } catch (err) {
    console.warn('[Desktop IPC] Window action failed:', err);
    return false;
  }
}

/**
 * Safely opens an external URL using the OS default browser.
 * Validates URL scheme to prevent arbitrary protocol injection. Inside the
 * shell the Rust check is authoritative: a rejected URL returns false and is
 * NOT silently opened via window.open (previous fallback masked validation).
 * Outside the shell, window.open is still used (browser behaviour unchanged).
 */
export async function openExternalUrl(url: string): Promise<DesktopOpenExternalUrlResult | false> {
  if (typeof window === 'undefined') return false;

  // Scheme validation: strictly http or https
  if (!url.startsWith('https://') && !url.startsWith('http://')) {
    console.warn('[Desktop IPC] Rejected invalid URL scheme:', url);
    return false;
  }

  if (!isDesktopApp()) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return { opened: true, url };
  }

  try {
    const win = window as any;
    if (win?.__TAURI_INTERNALS__?.invoke) {
      return (await win.__TAURI_INTERNALS__.invoke('open_external_url', { url })) as DesktopOpenExternalUrlResult;
    }
    if (win?.__TAURI__?.core?.invoke) {
      return (await win.__TAURI__.core.invoke('open_external_url', { url })) as DesktopOpenExternalUrlResult;
    }
    return false;
  } catch (err) {
    console.warn('[Desktop IPC] openExternalUrl failed:', err);
    return false;
  }
}
