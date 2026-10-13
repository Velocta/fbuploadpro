import { describe, it, expect } from 'vitest';
import {
  DESKTOP_SHELL_CONFIG,
  DESKTOP_TITLEBAR_HEIGHT,
  isDesktopApp,
  isMacDesktop,
  openExternalUrl,
  sendDesktopWindowAction,
} from '../src/index.js';
import { DesktopShellConfigSchema } from '@fbuploadpro/contracts';

describe('@fbuploadpro/desktop shell', () => {
  it('exports valid desktop shell configuration conforming to contracts', () => {
    expect(DESKTOP_SHELL_CONFIG.appName).toBe('FBUploadPro Desktop');
    expect(DESKTOP_SHELL_CONFIG.version).toBe('0.1.0');
    expect(DESKTOP_SHELL_CONFIG.userAgent).toBe('FBUploadProDesktop/0.1.0');
    expect(DESKTOP_SHELL_CONFIG.frameless).toBe(true);
    expect(DESKTOP_SHELL_CONFIG.defaultWidth).toBe(1240);
    expect(DESKTOP_SHELL_CONFIG.defaultHeight).toBe(740);
    expect(DESKTOP_SHELL_CONFIG.minWidth).toBe(960);
    expect(DESKTOP_SHELL_CONFIG.minHeight).toBe(580);
    expect(DESKTOP_TITLEBAR_HEIGHT).toBe(36);

    const validated = DesktopShellConfigSchema.parse(DESKTOP_SHELL_CONFIG);
    expect(validated.frameless).toBe(true);
  });

  it('exports helper functions from contracts', () => {
    expect(typeof isDesktopApp).toBe('function');
    expect(typeof isMacDesktop).toBe('function');
    expect(typeof openExternalUrl).toBe('function');
    expect(typeof sendDesktopWindowAction).toBe('function');
  });
});
