import { describe, it, expect } from 'vitest';
import {
  BRIDGE_VERSION,
  DESKTOP_BRIDGE_COMMANDS,
  DESKTOP_BRIDGE_EVENTS,
  DESKTOP_BRIDGE_REQUEST_SCHEMAS,
  DESKTOP_ARTIFACT_MANIFEST,
  DesktopArtifactManifestSchema,
  DesktopBridgeError,
  DesktopBridgeErrorSchema,
  AiCompleteRequestSchema,
  assertBridgeVersion,
  invokeDesktopCommand,
  ProcessSpawnRequestSchema,
  GetShellInfoResponseSchema,
  YtDlpDownloadRequestSchema,
} from '../src/domain/desktop-bridge.js';

describe('desktop bridge contract (spec 145, frozen v1.0)', () => {
  it('is version 1.0.0 with exactly 52 commands and 8 events', () => {
    expect(BRIDGE_VERSION).toBe('1.0.0');
    expect(DESKTOP_BRIDGE_COMMANDS).toHaveLength(52);
    expect(new Set(DESKTOP_BRIDGE_COMMANDS).size).toBe(52);
    expect(DESKTOP_BRIDGE_EVENTS).toHaveLength(8);
  });

  it('rejects a details object containing a filesystem-path key', () => {
    expect(
      DesktopBridgeErrorSchema.safeParse({
        code: 'INTERNAL_ERROR',
        message: 'x',
        retryable: false,
        details: { filePath: '/etc/passwd' },
      }).success,
    ).toBe(false);
    expect(
      DesktopBridgeErrorSchema.safeParse({
        code: 'AI_RATE_LIMITED',
        message: 'slow down',
        retryable: true,
        details: { retryAfterMs: 5000, runId: 'r1' },
      }).success,
    ).toBe(true);
  });

  it('throws BRIDGE_UNAVAILABLE outside the shell (jsdom has no __TAURI__)', async () => {
    await expect(invokeDesktopCommand('get_shell_info', {})).rejects.toMatchObject({ code: 'BRIDGE_UNAVAILABLE' });
    try {
      await invokeDesktopCommand('get_shell_info', {});
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(DesktopBridgeError);
    }
  });

  it('maps a bare-string rejection to INTERNAL_ERROR, never a raw string', () => {
    expect(DesktopBridgeError.fromUnknown('boom').code).toBe('INTERNAL_ERROR');
    expect(DesktopBridgeError.fromUnknown({ code: 'FS_NOT_FOUND', message: 'gone', retryable: false }).code).toBe('FS_NOT_FOUND');
  });

  it('rejects an AI payload containing apiKey (strict mode, not stripped)', () => {
    const base = { service: 'nicheforge', provider: 'openai', model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }] };
    expect(AiCompleteRequestSchema.safeParse({ ...base, apiKey: 'sk-secret' }).success).toBe(false);
    expect(AiCompleteRequestSchema.safeParse({ ...base, key: 'sk-secret' }).success).toBe(false);
    expect(AiCompleteRequestSchema.safeParse({ ...base, token: 'x' }).success).toBe(false);
    expect(AiCompleteRequestSchema.safeParse(base).success).toBe(true);
    // baseUrl rules: required for openai-compatible, forbidden for named providers
    expect(AiCompleteRequestSchema.safeParse({ ...base, provider: 'openai-compatible' }).success).toBe(false);
    expect(AiCompleteRequestSchema.safeParse({ ...base, baseUrl: 'https://api.example.com' }).success).toBe(false);
    expect(
      AiCompleteRequestSchema.safeParse({ ...base, provider: 'openai-compatible', baseUrl: 'https://api.example.com' }).success,
    ).toBe(true);
  });

  it('validates process-spawn guards (args cap, env allowlist, timeout, namespace, jobId)', () => {
    const base = { binaryId: 'ffmpeg', args: [] };
    expect(ProcessSpawnRequestSchema.safeParse({ ...base, args: Array(129).fill('x') }).success).toBe(false);
    expect(ProcessSpawnRequestSchema.safeParse({ ...base, env: { PATH: '/bin' } }).success).toBe(false);
    expect(ProcessSpawnRequestSchema.safeParse({ ...base, env: { MY_TOKEN: 'x' } }).success).toBe(false);
    expect(ProcessSpawnRequestSchema.safeParse({ ...base, env: { LD_PRELOAD: 'x' } }).success).toBe(false);
    expect(ProcessSpawnRequestSchema.safeParse({ ...base, env: { FFMPEG_FLAGS: '-y' } }).success).toBe(true);
    expect(ProcessSpawnRequestSchema.safeParse({ ...base, timeoutMs: 999 }).success).toBe(false);
    expect(ProcessSpawnRequestSchema.safeParse({ ...base, namespace: 'Bad NS' }).success).toBe(false);
    expect(ProcessSpawnRequestSchema.safeParse({ ...base, jobId: 'not-a-uuid' }).success).toBe(false);
  });

  it('validates the yt-dlp template/selector subset', () => {
    const base = { url: 'https://example.com/watch?v=abc', outputScopeId: 's1' };
    expect(YtDlpDownloadRequestSchema.safeParse({ ...base, outputTemplate: '%(title)s-%(id)s.%(ext)s' }).success).toBe(true);
    expect(YtDlpDownloadRequestSchema.safeParse({ ...base, outputTemplate: '%(duration)s.%(ext)s' }).success).toBe(false);
    expect(YtDlpDownloadRequestSchema.safeParse({ ...base, outputTemplate: '../%(title)s.%(ext)s' }).success).toBe(false);
    expect(YtDlpDownloadRequestSchema.safeParse({ ...base, outputTemplate: '%(title)s.%(ext)s', formatSelector: 'best; rm' }).success).toBe(false);
  });

  it('rejects manifest entries with a floating version, missing hash, or http URL', () => {
    const asset = { platform: 'linux-x64', url: 'https://example.com/yt-dlp', sha256: 'a'.repeat(64), archiveKind: 'none' };
    const entry = { artifactId: 'yt-dlp', kind: 'binary', version: '2025.01.01', description: 'x', assets: [asset] };
    expect(DesktopArtifactManifestSchema.safeParse([entry]).success).toBe(true);
    expect(DesktopArtifactManifestSchema.safeParse([{ ...entry, version: 'latest' }]).success).toBe(false);
    expect(DesktopArtifactManifestSchema.safeParse([{ ...entry, assets: [{ ...asset, sha256: 'short' }] }]).success).toBe(false);
    expect(DesktopArtifactManifestSchema.safeParse([{ ...entry, assets: [{ ...asset, url: 'http://example.com/x' }] }]).success).toBe(false);
    // PR-145-A ships shape only: no fake hashes, so the value manifest is empty
    expect(DESKTOP_ARTIFACT_MANIFEST).toEqual([]);
  });

  it('parses the get_shell_info response shape', () => {
    expect(
      GetShellInfoResponseSchema.safeParse({
        appName: 'FBUploadPro Desktop', version: '0.1.0', bridgeVersion: '1.0.0', platform: 'linux', arch: 'x86_64',
        frameless: true, window: { defaultWidth: 1240, defaultHeight: 740, minWidth: 960, minHeight: 580 },
        capabilities: { filesystem: true, process: true, dialogs: true, secrets: true, artifacts: true, media: true, ai: true },
      }).success,
    ).toBe(true);
  });

  it('enforces §12.2 version compatibility (same major, minor >= required)', () => {
    expect(() => assertBridgeVersion({ bridgeVersion: '1.0.0' }, 1, 0)).not.toThrow();
    expect(() => assertBridgeVersion({ bridgeVersion: '1.2.0' }, 1, 0)).not.toThrow();
    expect(() => assertBridgeVersion({ bridgeVersion: '2.0.0' }, 1, 0)).toThrowError(/update/i);
    expect(() => assertBridgeVersion({ bridgeVersion: '1.0.0' }, 1, 1)).toThrowError(/update/i);
  });

  it('covers a request schema for every payload command', () => {
    const payloadCommands = DESKTOP_BRIDGE_COMMANDS.filter((c) => !['get_shell_info', 'shell_get_start_url', 'shell_forget_tenant', 'shell_retry_connection', 'fs_scope_list', 'process_list', 'binary_list', 'sidecar_model_list'].includes(c) && !['handle_window_action', 'open_external_url'].includes(c));
    for (const cmd of payloadCommands) {
      expect(DESKTOP_BRIDGE_REQUEST_SCHEMAS[cmd], `missing request schema: ${cmd}`).toBeDefined();
    }
  });
});
