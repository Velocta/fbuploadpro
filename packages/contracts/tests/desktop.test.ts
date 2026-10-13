import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isDesktopApp,
  isMacDesktop,
  sendDesktopWindowAction,
  openExternalUrl,
  DesktopWindowActionEnum,
  DesktopShellConfigSchema,
} from '../src/domain/desktop.js';

describe('desktop contracts domain', () => {
  const originalWindow = (globalThis as any).window;
  const originalNavigator = globalThis.navigator;

  function setNavigator(props: { userAgent?: string; platform?: string }) {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        userAgent: props.userAgent ?? '',
        platform: props.platform ?? '',
      },
      configurable: true,
      writable: true,
    });
  }

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
    if (originalNavigator !== undefined) {
      Object.defineProperty(globalThis, 'navigator', {
        value: originalNavigator,
        configurable: true,
        writable: true,
      });
    } else {
      delete (globalThis as any).navigator;
    }
  });

  it('validates window actions with DesktopWindowActionEnum', () => {
    expect(DesktopWindowActionEnum.parse('minimize')).toBe('minimize');
    expect(DesktopWindowActionEnum.parse('maximize')).toBe('maximize');
    expect(DesktopWindowActionEnum.parse('unmaximize')).toBe('unmaximize');
    expect(DesktopWindowActionEnum.parse('toggle_maximize')).toBe('toggle_maximize');
    expect(DesktopWindowActionEnum.parse('close')).toBe('close');
    expect(() => DesktopWindowActionEnum.parse('invalid_action')).toThrow();
  });

  it('validates desktop shell config schema', () => {
    const validConfig = {
      appName: 'FBUploadPro Desktop',
      version: '0.1.0',
      userAgent: 'FBUploadProDesktop/0.1.0',
      frameless: true,
      defaultWidth: 1240,
      defaultHeight: 740,
      minWidth: 960,
      minHeight: 580,
    };
    expect(DesktopShellConfigSchema.parse(validConfig)).toEqual(validConfig);
  });

  it('detects desktop environment via __TAURI_INTERNALS__', () => {
    (globalThis as any).window = {
      __TAURI_INTERNALS__: { invoke: vi.fn() },
    };
    setNavigator({ userAgent: 'Mozilla/5.0 Chrome/130' });
    expect(isDesktopApp()).toBe(true);
  });

  it('detects desktop environment via User-Agent', () => {
    (globalThis as any).window = {};
    setNavigator({ userAgent: 'Mozilla/5.0 FBUploadProDesktop/0.1.0 Chrome/130' });
    expect(isDesktopApp()).toBe(true);
  });

  it('returns false for isDesktopApp in standard browser', () => {
    (globalThis as any).window = {};
    setNavigator({ userAgent: 'Mozilla/5.0 Chrome/130 Safari/537.36' });
    expect(isDesktopApp()).toBe(false);
  });

  it('detects macOS platform via isMacDesktop', () => {
    setNavigator({
      platform: 'MacIntel',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    });
    expect(isMacDesktop()).toBe(true);

    setNavigator({
      platform: 'Win32',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    });
    expect(isMacDesktop()).toBe(false);
  });

  it('dispatches window action via Tauri invoke', async () => {
    const invokeMock = vi.fn().mockResolvedValue('ok');
    (globalThis as any).window = {
      __TAURI_INTERNALS__: { invoke: invokeMock },
    };
    setNavigator({ userAgent: 'Mozilla/5.0 FBUploadProDesktop/0.1.0' });

    const result = await sendDesktopWindowAction('minimize');
    expect(result).toBe(true);
    expect(invokeMock).toHaveBeenCalledWith('handle_window_action', { action: 'minimize' });
  });

  it('returns false when sendDesktopWindowAction called outside desktop', async () => {
    (globalThis as any).window = {};
    setNavigator({ userAgent: 'Chrome/130' });

    const result = await sendDesktopWindowAction('close');
    expect(result).toBe(false);
  });

  it('validates URL schemes and opens external URLs', async () => {
    const openMock = vi.fn();
    (globalThis as any).window = { open: openMock };
    setNavigator({ userAgent: 'Chrome/130' });

    // Standard web fallback
    const resWeb = await openExternalUrl('https://example.com');
    expect(resWeb).toBe(true);
    expect(openMock).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer');

    // Rejects non-http schemes
    expect(await openExternalUrl('file:///etc/passwd')).toBe(false);
    expect(await openExternalUrl('javascript:alert(1)')).toBe(false);

    // Tauri IPC invoke
    const invokeMock = vi.fn().mockResolvedValue('ok');
    (globalThis as any).window = {
      __TAURI_INTERNALS__: { invoke: invokeMock },
    };
    setNavigator({ userAgent: 'Mozilla/5.0 FBUploadProDesktop/0.1.0' });

    const resDesktop = await openExternalUrl('https://facebook.com');
    expect(resDesktop).toBe(true);
    expect(invokeMock).toHaveBeenCalledWith('open_external_url', { url: 'https://facebook.com' });
  });
});
