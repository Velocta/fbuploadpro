/**
 * NicheForge e2e (spec 147 §9).
 *
 * Fixture-served, stub bridge: the desktop context is faked by installing
 * a __TAURI_INTERNALS__.invoke + __TAURI__.event.listen pair via
 * addInitScript that answers every frozen bridge command from in-memory
 * state persisted to localStorage (so the reload-persistence test sees
 * the same store). No live provider, no live download, no real key.
 * The browser-context gate test installs no Tauri fake at all.
 */
import { test, expect, type Page } from '@playwright/test';
import { createFixtureState, installApiFixtures } from './fixtures/api';
import { SESSION_COOKIE, TENANT } from './fixtures/tenant';

const SUB = TENANT.subdomain;
const BREAKDOWN_JSON = JSON.stringify({
  hook: 'The mug complains in the first second',
  hookType: 'bold-claim',
  structure: ['Hook: complaint', 'Payoff: sip'],
  pacing: 'Fast cuts, no dead air.',
  topic: 'Office coffee',
  format: 'short-form vertical',
  whyItWorked: 'It names a shared annoyance immediately. The payoff lands fast.',
  replicableTakeaways: ['Open on the complaint, not the setup.'],
  transcriptAvailable: true,
  transcriptTruncated: false,
  confidence: 'high',
  confidenceReason: 'Full transcript analysed.',
});
const REPORT_JSON = JSON.stringify({
  recurringHooks: [{ hookType: 'bold-claim', count: 2, exampleVideoIds: [] }],
  commonFormats: [{ format: 'short-form vertical', count: 2 }],
  lengthInsights: ['Videos cluster under 60 seconds.'],
  postingPatterns: [],
  topicClusters: [{ topic: 'Office coffee', videoIds: [] }],
  actionablePlaybook: [{ kind: 'do', text: 'Open on the complaint.', sourceVideoIds: [] }],
  coverage: { attempted: 2, analysed: 2, transcriptBased: 2, metadataOnly: 0 },
  modelId: 'gemini-2.5-flash',
  provider: 'gemini',
  promptVersion: '1',
  generatedAt: '2026-10-24T00:01:00Z',
});

/**
 * Fake Tauri backend, installed before any app script runs. State lives in
 * localStorage under e2e-nicheforge-fake so a page reload keeps the store.
 */
function installFakeTauri() {
  const script = `
    (() => {
      const KEY = 'e2e-nicheforge-fake';
      const load = () => {
        try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
      };
      let state = load();
      state.files = state.files || {};
      state.secrets = state.secrets || {};
      state.processCalls = state.processCalls || {};
      state.aiCounter = state.aiCounter || 0;
      const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };
      const err = (code, message) => ({ code, message, retryable: false });
      const listeners = {};
      const emit = (event, payload) => {
        (listeners[event] || []).forEach((h) => { try { h({ payload }); } catch {} });
      };
      const fsKey = (scopeId, rel) => scopeId + ':' + rel;
      const VTT = 'WEBVTT\\n\\n00:00:00.000 --> 00:00:02.000\\nHello world this is a caption.\\n';
      const breakdown = ${JSON.stringify(BREAKDOWN_JSON)};
      const report = ${JSON.stringify(REPORT_JSON)};
      const invoke = async (command, args) => {
        const p = (args && args.payload) || {};
        switch (command) {
          case 'get_shell_info':
            return { appName: 'FBUploadPro', version: '0.0.0-e2e', bridgeVersion: '1.0.0', platform: 'linux', arch: 'x64', frameless: false, window: { defaultWidth: 1280, defaultHeight: 800, minWidth: 800, minHeight: 600 }, capabilities: { filesystem: true, process: true, dialogs: true, secrets: true, artifacts: true, media: true, ai: true } };
          case 'binary_status':
            return { artifact: { artifactId: 'yt-dlp', kind: 'binary', state: 'ready', version: '2026.01.01' } };
          case 'fs_scope_list':
            return { scopes: [{ scopeId: 'e2e-scope', kind: 'directory', path: '/e2e' }] };
          case 'dialog_open_directory':
            return { directories: [{ path: '/e2e', scopeId: 'e2e-scope', name: 'e2e' }], cancelled: false };
          case 'dialog_save_file':
            return { path: '/e2e/report.md', scopeId: 'e2e-save-scope', cancelled: false };
          case 'fs_read_text': {
            const k = fsKey(p.scopeId, p.relativePath || '');
            if (p.relativePath && p.relativePath.endsWith('.vtt')) return { content: VTT, truncated: false, sizeBytes: VTT.length };
            if (state.files[k] !== undefined) return { content: state.files[k], truncated: false, sizeBytes: state.files[k].length };
            throw err('FS_NOT_FOUND', 'File not found.');
          }
          case 'fs_write_text': {
            state.files[fsKey(p.scopeId, p.relativePath)] = p.content; save();
            return { relativePath: p.relativePath, sizeBytes: p.content.length, overwritten: true };
          }
          case 'fs_delete': {
            const prefix = fsKey(p.scopeId, p.relativePath);
            Object.keys(state.files).forEach((k) => { if (k === prefix || k.startsWith(prefix + '/')) delete state.files[k]; });
            save();
            return { relativePath: p.relativePath, deleted: true };
          }
          case 'fs_move': {
            const src = fsKey(p.sourceScopeId, p.sourceRelativePath);
            const dst = fsKey(p.destScopeId, p.destRelativePath);
            if (state.files[src] === undefined) throw err('FS_NOT_FOUND', 'File not found.');
            state.files[dst] = state.files[src]; delete state.files[src]; save();
            return { destRelativePath: p.destRelativePath, sizeBytes: state.files[dst].length };
          }
          case 'fs_list': {
            const dir = p.relativePath || '';
            const entries = [];
            if (dir.startsWith('nicheforge/tmp/')) {
              const base = dir;
              entries.push({ name: 'video123.en.vtt', relativePath: base + '/video123.en.vtt', kind: 'file', sizeBytes: VTT.length, modifiedAt: null });
              entries.push({ name: 'video123.mp4', relativePath: base + '/video123.mp4', kind: 'file', sizeBytes: 1024, modifiedAt: null });
            } else {
              Object.keys(state.files).forEach((k) => {
                const rel = k.slice(k.indexOf(':') + 1);
                if (rel.startsWith(dir + '/')) entries.push({ name: rel.split('/').pop(), relativePath: rel, kind: 'file', sizeBytes: state.files[k].length, modifiedAt: null });
              });
            }
            return { entries };
          }
          case 'secrets_set': {
            state.secrets[p.service + ':' + p.keyName] = p.value; save();
            return { service: p.service, keyName: p.keyName, stored: true };
          }
          case 'secrets_has':
            return { service: p.service, keyName: p.keyName, present: state.secrets[p.service + ':' + p.keyName] !== undefined };
          case 'secrets_list': {
            const names = Object.keys(state.secrets).filter((k) => k.startsWith(p.service + ':')).map((k) => k.split(':')[1]);
            return { service: p.service, keyNames: names };
          }
          case 'secrets_delete': {
            delete state.secrets[p.service + ':' + p.keyName]; save();
            return { service: p.service, keyName: p.keyName, deleted: true };
          }
          case 'media_yt_dlp_metadata': {
            const gone = p.url.includes('gone');
            return { metadata: { title: gone ? 'Gone video' : 'E2E video', uploader: 'E2E channel', durationSeconds: 42, thumbnailUrl: null, formats: [] } };
          }
          case 'media_yt_dlp_subtitles':
            return { subtitles: [{ language: 'en', formats: ['vtt'] }], automaticCaptions: [] };
          case 'media_yt_dlp_download': {
            const runId = 'e2e-media-' + Math.random().toString(36).slice(2);
            state.processCalls[runId] = 0; save();
            return { runId, outputScopeId: p.outputScopeId, outputTemplate: p.outputTemplate };
          }
          case 'process_status': {
            const n = (state.processCalls[p.runId] || 0) + 1;
            state.processCalls[p.runId] = n; save();
            const failed = false;
            void failed;
            // The 'gone' video is detected by the run id? No — downloads are
            // per-URL, but the fake cannot see the URL here. Failure for the
            // gone video is driven by process exit code below via a marker:
            const marker = localStorage.getItem('e2e-fail-next-download');
            if (n === 1) return { runId: p.runId, state: 'running', exitCode: null, startedAt: new Date().toISOString(), endedAt: null };
            if (marker === '1') { localStorage.removeItem('e2e-fail-next-download'); return { runId: p.runId, state: 'exited', exitCode: 1, startedAt: new Date().toISOString(), endedAt: new Date().toISOString() }; }
            return { runId: p.runId, state: 'exited', exitCode: 0, startedAt: new Date().toISOString(), endedAt: new Date().toISOString() };
          }
          case 'process_cancel':
            return { runId: p.runId, state: 'cancelled', alreadyExited: false };
          case 'ai_complete':
            return { output: 'OK', model: p.model, usage: null, finishReason: 'stop' };
          case 'ai_complete_stream': {
            state.aiCounter += 1; save();
            const requestId = 'e2e-ai-' + state.aiCounter;
            const userText = (p.messages || []).map((m) => m.content).join('\\n');
            const output = userText.includes('mine patterns') ? report : breakdown;
            const delay = Number(localStorage.getItem('e2e-ai-delay-ms') || '0');
            setTimeout(() => emit('desktop:ai:done', { seq: 1, emittedAt: new Date().toISOString(), requestId, status: 'succeeded', output, usage: null }), delay);
            return { requestId };
          }
          case 'ai_cancel': {
            emit('desktop:ai:done', { seq: 2, emittedAt: new Date().toISOString(), requestId: p.requestId, status: 'cancelled', output: null, usage: null });
            return { requestId: p.requestId, cancelled: true };
          }
          case 'ai_status':
            return { service: p.service, hasKey: true };
          default:
            throw err('INTERNAL_ERROR', 'Unknown fake command: ' + command);
        }
      };
      window.__TAURI_INTERNALS__ = { invoke };
      window.__TAURI__ = {
        core: { invoke },
        event: {
          listen: async (event, handler) => {
            listeners[event] = listeners[event] || [];
            listeners[event].push(handler);
            return () => { listeners[event] = (listeners[event] || []).filter((h) => h !== handler); };
          },
        },
      };
    })();
  `;
  return script;
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement;
    return el ? el.scrollWidth - el.clientWidth : 0;
  });
  expect(overflow).toBeLessThanOrEqual(0);
}

async function openWorkspace(page: Page) {
  await page.goto(`/tenant/${SUB}/nicheforge`);
  await expect(page.getByTestId('nicheforge-workspace')).toBeVisible({ timeout: 15_000 });
  // First mount asks for a research folder (dialog-pick scope model).
  const pick = page.getByTestId('nicheforge-pick-folder');
  if (await pick.isVisible().catch(() => false)) {
    await pick.click();
  }
  await expect(page.getByTestId('keys-panel')).toBeVisible({ timeout: 15_000 });
}

async function addKey(page: Page, label: string, key: string) {
  await page.getByTestId('key-form-label').fill(label);
  await page.getByTestId('key-form-key').fill(key);
  await page.getByTestId('key-form-submit').click();
  await expect(page.getByTestId('key-masked').first()).toBeVisible({ timeout: 10_000 });
}

test.describe('nicheforge', () => {
  test('browser context shows only the desktop-only placeholder', async ({ page, context }) => {
    await context.addCookies([SESSION_COOKIE]);
    const state = createFixtureState();
    await installApiFixtures(page, state);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/tenant/${SUB}/nicheforge`);
    await expect(page.getByTestId('nicheforge-gate')).toBeVisible({ timeout: 15_000 });
    expect(await page.getByTestId('nicheforge-workspace').count()).toBe(0);
    expect(await page.getByTestId('key-form').count()).toBe(0);
    await expectNoHorizontalOverflow(page);
  });

  test('desktop happy path: key, run, breakdown, report, persistence across reload', async ({ page, context }) => {
    await context.addCookies([SESSION_COOKIE]);
    const state = createFixtureState();
    await installApiFixtures(page, state);
    await page.addInitScript(installFakeTauri());
    await page.setViewportSize({ width: 1280, height: 900 });
    await openWorkspace(page);
    await addKey(page, 'Main Gemini key', 'e2e-test-key-1234');
    await expect(page.getByTestId('key-masked').first()).toHaveText('••••1234');
    await page.getByTestId('key-validate').first().click();
    await expect(page.getByTestId('key-validation').first()).toHaveText('Valid', { timeout: 10_000 });

    await page.getByTestId('run-form-urls').fill('https://www.youtube.com/watch?v=aaa111\nhttps://www.tiktok.com/@someone/video/123');
    await expect(page.getByTestId('run-form-preview')).toContainText('youtube');
    await page.getByTestId('run-form-submit').click();
    await expect(page.getByTestId('run-detail')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('run-video-breakdown').first()).toContainText('The mug complains');
    await expect(page.getByTestId('report-content')).toContainText('Recurring hooks');
    await expect(page.getByTestId('report-coverage')).toContainText('2 of 2 videos analysed');
    await expectNoHorizontalOverflow(page);

    // Persistence: reload, the run is still listed and reopens identically.
    await page.reload();
    await expect(page.getByTestId('runs-list')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('run-row').first()).toContainText('Research run');
    await page.getByTestId('run-row-open').first().click();
    await expect(page.getByTestId('run-detail')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('run-video-breakdown').first()).toContainText('The mug complains');
  });

  test('partial failure: one un-downloadable video, run still completes with its reason', async ({ page, context }) => {
    await context.addCookies([SESSION_COOKIE]);
    const state = createFixtureState();
    await installApiFixtures(page, state);
    await page.addInitScript(installFakeTauri());
    await openWorkspace(page);
    await addKey(page, 'Main Gemini key', 'e2e-test-key-1234');
    // Mark the next download as failing (the 'gone' video's download).
    await page.evaluate(() => localStorage.setItem('e2e-fail-next-download', '1'));
    await page.getByTestId('run-form-urls').fill('https://www.youtube.com/watch?v=gone123\nhttps://www.youtube.com/watch?v=aaa111');
    await page.getByTestId('run-form-submit').click();
    await expect(page.getByTestId('run-detail')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('run-video-failure').first()).toContainText('could not be downloaded');
    await expect(page.getByTestId('run-video-breakdown').first()).toContainText('The mug complains');
  });

  test('all-fail run is failed, never an empty success', async ({ page, context }) => {
    await context.addCookies([SESSION_COOKIE]);
    const state = createFixtureState();
    await installApiFixtures(page, state);
    await page.addInitScript(installFakeTauri());
    await openWorkspace(page);
    await addKey(page, 'Main Gemini key', 'e2e-test-key-1234');
    await page.evaluate(() => localStorage.setItem('e2e-fail-next-download', '1'));
    await page.getByTestId('run-form-urls').fill('https://www.youtube.com/watch?v=gone123');
    await page.getByTestId('run-form-submit').click();
    await expect(page.getByTestId('run-detail')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('run-detail')).toContainText('Failed');
    expect(await page.getByTestId('run-video-breakdown').count()).toBe(0);
    expect(await page.getByTestId('report-content').count()).toBe(0);
  });

  test('cancel keeps the run record as cancelled', async ({ page, context }) => {
    await context.addCookies([SESSION_COOKIE]);
    const state = createFixtureState();
    await installApiFixtures(page, state);
    await page.addInitScript(installFakeTauri());
    await openWorkspace(page);
    await addKey(page, 'Main Gemini key', 'e2e-test-key-1234');
    await page.evaluate(() => localStorage.setItem('e2e-ai-delay-ms', '30000'));
    await page.getByTestId('run-form-urls').fill('https://www.youtube.com/watch?v=aaa111');
    await page.getByTestId('run-form-submit').click();
    await expect(page.getByTestId('run-progress')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('run-cancel').click();
    await expect(page.getByTestId('run-detail')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('run-detail')).toContainText('Cancelled');
  });

  test('keys flow: add masked key, validate, delete', async ({ page, context }) => {
    await context.addCookies([SESSION_COOKIE]);
    const state = createFixtureState();
    await installApiFixtures(page, state);
    await page.addInitScript(installFakeTauri());
    await openWorkspace(page);
    await addKey(page, 'Key one', 'e2e-test-key-1111');
    await addKey(page, 'Key two', 'e2e-test-key-2222');
    expect(await page.getByTestId('key-row').count()).toBe(2);
    await page.getByTestId('key-delete').last().click();
    await page.getByRole('button', { name: 'Delete key' }).click();
    await expect(page.getByTestId('key-row')).toHaveCount(1);
  });
});
