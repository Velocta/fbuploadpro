import { describe, it, expect } from 'vitest';
import { EXTENSION_SHELL_CONFIG } from '../src/index.js';
import manifest from '../manifest.json';

describe('@fbuploadpro/extension shell', () => {
  it('exports valid extension shell configuration', () => {
    expect(EXTENSION_SHELL_CONFIG.name).toBe('FBUploadPro Companion');
    expect(EXTENSION_SHELL_CONFIG.version).toBe('0.1.0');
    expect(EXTENSION_SHELL_CONFIG.manifestVersion).toBe(3);
    expect(EXTENSION_SHELL_CONFIG.permissions).toContain('activeTab');
    expect(EXTENSION_SHELL_CONFIG.permissions).toContain('storage');
  });

  it('declares compliant Manifest V3 specification', () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe('FBUploadPro Companion');
    expect(manifest.permissions).toContain('activeTab');
    expect(manifest.permissions).toContain('storage');
  });
});
