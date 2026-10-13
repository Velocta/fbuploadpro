import { describe, it, expect } from 'vitest';
import { DESKTOP_SHELL_CONFIG } from '../src/index.js';

describe('@fbuploadpro/desktop shell', () => {
  it('exports valid desktop shell configuration', () => {
    expect(DESKTOP_SHELL_CONFIG.appName).toBe('FBUploadPro Desktop');
    expect(DESKTOP_SHELL_CONFIG.version).toBe('0.1.0');
    expect(DESKTOP_SHELL_CONFIG.enableFolderWatcher).toBe(true);
  });
});
