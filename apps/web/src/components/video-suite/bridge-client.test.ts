import { describe, expect, it } from 'vitest';
import { DesktopBridgeError } from '@fbuploadpro/contracts';
import {
  conversionOutputFileName,
  downloadFormatSelector,
  downloadOutputTemplate,
  mapBridgeErrorToVideoSuiteCode,
  supportsLibraryUpload,
  supportsReveal,
} from './bridge-client';

describe('bridge error mapping', () => {
  it('maps binary problems to binary_not_ready', () => {
    expect(mapBridgeErrorToVideoSuiteCode(new DesktopBridgeError('BINARY_NOT_READY', 'x', true), 'download').code).toBe('binary_not_ready');
    expect(mapBridgeErrorToVideoSuiteCode(new DesktopBridgeError('ARTIFACT_OFFLINE', 'x', true), 'convert').code).toBe('binary_not_ready');
  });
  it('maps timeouts to network_failure and convert failures to conversion_failed', () => {
    expect(mapBridgeErrorToVideoSuiteCode(new DesktopBridgeError('MEDIA_TIMEOUT', 'x', true), 'download').code).toBe('network_failure');
    expect(mapBridgeErrorToVideoSuiteCode(new DesktopBridgeError('MEDIA_CONVERT_FAILED', 'x', true), 'convert').code).toBe('conversion_failed');
  });
  it('maps metadata fetch collapse to unsupported_url (bridge cannot distinguish)', () => {
    expect(mapBridgeErrorToVideoSuiteCode(new DesktopBridgeError('MEDIA_NOT_FOUND', 'No media was found at that URL.', false), 'metadata').code).toBe('unsupported_url');
  });
  it('maps permission errors and unknown codes honestly', () => {
    expect(mapBridgeErrorToVideoSuiteCode(new DesktopBridgeError('FS_PERMISSION_DENIED', 'x', false), 'download').code).toBe('permission_denied');
    expect(mapBridgeErrorToVideoSuiteCode(new DesktopBridgeError('INTERNAL_ERROR', 'x', false), 'generic').code).toBe('unknown');
    expect(mapBridgeErrorToVideoSuiteCode('a bare string', 'generic').code).toBe('unknown');
  });
  it('keeps the bridge message as local-only detail, never as the user message', () => {
    const mapped = mapBridgeErrorToVideoSuiteCode(new DesktopBridgeError('MEDIA_TIMEOUT', 'timed out after 120s', true), 'download');
    expect(mapped.detail).toBe('timed out after 120s');
  });
});

describe('download templates and selectors', () => {
  it('builds a template-safe output template from the title', () => {
    expect(downloadOutputTemplate('Chai Time Friday')).toBe('Chai Time Friday.%(ext)s');
    expect(downloadOutputTemplate(null)).toBe('download.%(ext)s');
    // '%' is stripped from the literal so a title can't inject template fields.
    expect(downloadOutputTemplate('100% (cool)')).not.toContain('% (');
  });
  it('maps presets and explicit formats to selectors', () => {
    expect(downloadFormatSelector({ kind: 'preset', preset: 'best_720' })).toBe('bestvideo[height<=720]+bestaudio');
    expect(downloadFormatSelector({ kind: 'format', formatId: '137' })).toBe('137');
  });
});

describe('conversion output names', () => {
  it('uses the target extension (mp3 is not expressible in v1.0)', () => {
    expect(conversionOutputFileName('my clip.mp4', 'mp4')).toBe('my clip.mp4');
    expect(conversionOutputFileName('my clip.mkv', 'webm')).toBe('my clip.webm');
    expect(conversionOutputFileName('song.mp4', 'opus')).toBe('song.opus');
  });
});

describe('v1.0 capability gaps (structural — these fail if an amendment lands, by design)', () => {
  it('no disk→R2 upload command exists in the frozen index', () => {
    expect(supportsLibraryUpload()).toBe(false);
  });
  it('no reveal-in-folder command exists in the frozen index', () => {
    expect(supportsReveal()).toBe(false);
  });
});
