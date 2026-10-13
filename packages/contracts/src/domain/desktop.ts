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
    navigator.userAgent &&
    navigator.userAgent.includes('FBUploadProDesktop')
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
 * Safely dispatches a window management action to the native Tauri Rust backend.
 * Gracefully returns false in non-desktop browser environments.
 */
export async function sendDesktopWindowAction(action: DesktopWindowAction): Promise<boolean> {
  if (!isDesktopApp()) return false;
  try {
    const win = typeof window !== 'undefined' ? (window as any) : undefined;
    if (win?.__TAURI_INTERNALS__?.invoke) {
      await win.__TAURI_INTERNALS__.invoke('handle_window_action', { action });
      return true;
    }
    if (win?.__TAURI__?.core?.invoke) {
      await win.__TAURI__.core.invoke('handle_window_action', { action });
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[Desktop IPC] Window action failed:', err);
    return false;
  }
}

/**
 * Safely opens an external URL using the OS default browser.
 * Validates URL scheme to prevent arbitrary protocol injection.
 */
export async function openExternalUrl(url: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // Scheme validation: strictly http or https
  if (!url.startsWith('https://') && !url.startsWith('http://')) {
    console.warn('[Desktop IPC] Rejected invalid URL scheme:', url);
    return false;
  }

  if (!isDesktopApp()) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  }

  try {
    const win = window as any;
    if (win?.__TAURI_INTERNALS__?.invoke) {
      await win.__TAURI_INTERNALS__.invoke('open_external_url', { url });
      return true;
    }
    if (win?.__TAURI__?.core?.invoke) {
      await win.__TAURI__.core.invoke('open_external_url', { url });
      return true;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  } catch (err) {
    console.warn('[Desktop IPC] openExternalUrl failed, falling back to window.open:', err);
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  }
}
