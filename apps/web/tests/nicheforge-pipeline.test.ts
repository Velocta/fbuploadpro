import { describe, expect, it } from 'vitest';
import {
  createRunController,
  runResearchRun,
} from '@/lib/nicheforge/run-pipeline';
import {
  BREAKDOWN_JSON,
  defaultProviderHandler,
  makeStubSlot,
  REPORT_JSON,
  StubNicheforgeBridge,
} from './helpers/nicheforge-stub-bridge';

const YT1 = 'https://www.youtube.com/watch?v=aaa111';
const YT2 = 'https://youtu.be/bbb222';
const TT1 = 'https://www.tiktok.com/@someone/video/123';

function inputs(urls: string[]) {
  return urls.map((url) => ({
    url,
    platform: (url.includes('tiktok') ? 'tiktok' : 'youtube') as 'youtube' | 'tiktok',
  }));
}

describe('runResearchRun', () => {
  it('completes a happy-path run with breakdowns and a report', async () => {
    const bridge = new StubNicheforgeBridge({ provider: defaultProviderHandler });
    const result = await runResearchRun(
      { inputs: inputs([YT1, YT2]), provider: 'gemini' },
      bridge,
      createRunController(),
    );
    expect(result.outcome).toBe('completed');
    if (result.outcome !== 'completed') return;
    expect(result.run.status).toBe('done');
    expect(result.run.videos).toHaveLength(2);
    expect(result.run.videos.every((v) => v.status === 'done')).toBe(true);
    expect(result.run.videos[0].breakdown?.hook).toContain('mug complains');
    expect(result.run.report?.commonFormats[0].format).toBe('short-form vertical');
    expect(result.run.report?.coverage).toMatchObject({ attempted: 2, analysed: 2, transcriptBased: 2 });
    expect(bridge.cleanCalls).toContain(result.run.id);
    expect(bridge.index).toHaveLength(1);
  });

  it('keeps going when one video fails and still reports', async () => {
    const bridge = new StubNicheforgeBridge({
      provider: defaultProviderHandler,
      videos: {
        [YT1]: {
          metadata: { title: 'Bad video', uploader: null, durationSeconds: 30, thumbnailUrl: null },
          downloadError: 'failed',
        },
      },
    });
    const result = await runResearchRun({ inputs: inputs([YT1, YT2]), provider: 'gemini' }, bridge, createRunController());
    expect(result.outcome).toBe('completed');
    if (result.outcome !== 'completed') return;
    expect(result.run.status).toBe('done');
    expect(result.run.videos[0].status).toBe('failed');
    expect(result.run.videos[0].failureReason).toBe('DOWNLOAD_FAILED');
    expect(result.run.videos[1].status).toBe('done');
    expect(result.run.report).not.toBeNull();
  });

  it('fails the run when zero videos succeed (never an empty success)', async () => {
    const bridge = new StubNicheforgeBridge({
      provider: defaultProviderHandler,
      videos: {
        [YT1]: { metadata: { title: 'Bad 1', uploader: null, durationSeconds: 30, thumbnailUrl: null }, downloadError: 'failed' },
        [YT2]: { metadata: { title: 'Bad 2', uploader: null, durationSeconds: 30, thumbnailUrl: null }, downloadError: 'failed' },
      },
    });
    const result = await runResearchRun({ inputs: inputs([YT1, YT2]), provider: 'gemini' }, bridge, createRunController());
    expect(result.outcome).toBe('completed');
    if (result.outcome !== 'completed') return;
    expect(result.run.status).toBe('failed');
    expect(result.run.report).toBeNull();
  });

  it('marks a 61-minute video VIDEO_TOO_LONG without downloading it', async () => {
    const bridge = new StubNicheforgeBridge({
      provider: defaultProviderHandler,
      videos: {
        [YT1]: { metadata: { title: 'Long video', uploader: null, durationSeconds: 3661, thumbnailUrl: null } },
      },
    });
    const result = await runResearchRun({ inputs: inputs([YT1, YT2]), provider: 'gemini' }, bridge, createRunController());
    expect(result.outcome).toBe('completed');
    if (result.outcome !== 'completed') return;
    expect(result.run.videos[0].failureReason).toBe('VIDEO_TOO_LONG');
    expect(bridge.downloadCalls).not.toContain(YT1);
    expect(bridge.downloadCalls).toContain(YT2);
    expect(result.run.status).toBe('done');
  });

  it('keeps breakdowns when mining fails, with reportError set', async () => {
    const bridge = new StubNicheforgeBridge({
      provider: ({ prompt }) => {
        if (prompt.includes('mine patterns')) return { status: 'ok', text: 'not json at all {{{' };
        if (prompt.includes('could not be read as JSON')) return { status: 'ok', text: 'still not json' };
        return { status: 'ok', text: BREAKDOWN_JSON };
      },
    });
    const result = await runResearchRun({ inputs: inputs([YT1]), provider: 'gemini' }, bridge, createRunController());
    expect(result.outcome).toBe('completed');
    if (result.outcome !== 'completed') return;
    expect(result.run.status).toBe('done');
    expect(result.run.report).toBeNull();
    expect(result.run.reportError).toBe('REPORT_FAILED');
    expect(result.run.videos[0].breakdown).not.toBeNull();
  });

  it('repairs a malformed breakdown once, then succeeds', async () => {
    let calls = 0;
    const bridge = new StubNicheforgeBridge({
      provider: ({ prompt }) => {
        if (prompt.includes('mine patterns')) return { status: 'ok', text: REPORT_JSON };
        calls += 1;
        if (calls === 1) return { status: 'ok', text: '{broken json' };
        return { status: 'ok', text: BREAKDOWN_JSON };
      },
    });
    const result = await runResearchRun({ inputs: inputs([YT1]), provider: 'gemini' }, bridge, createRunController());
    expect(result.outcome).toBe('completed');
    if (result.outcome !== 'completed') return;
    expect(result.run.videos[0].status).toBe('done');
    expect(calls).toBe(2);
  });

  it('fails twice-malformed output as ANALYSIS_PARSE_FAILED', async () => {
    const bridge = new StubNicheforgeBridge({ provider: () => ({ status: 'ok', text: '{broken' }) });
    const result = await runResearchRun({ inputs: inputs([YT1]), provider: 'gemini' }, bridge, createRunController());
    expect(result.outcome).toBe('completed');
    if (result.outcome !== 'completed') return;
    expect(result.run.videos[0].failureReason).toBe('ANALYSIS_PARSE_FAILED');
    expect(result.run.status).toBe('failed');
  });

  it('fails empty model output as ANALYSIS_EMPTY', async () => {
    const bridge = new StubNicheforgeBridge({ provider: () => ({ status: 'ok', text: '   ' }) });
    const result = await runResearchRun({ inputs: inputs([YT1]), provider: 'gemini' }, bridge, createRunController());
    expect(result.outcome).toBe('completed');
    if (result.outcome !== 'completed') return;
    expect(result.run.videos[0].failureReason).toBe('ANALYSIS_EMPTY');
  });

  it('rotates to the second key on 429 and cools the first down', async () => {
    const k1 = makeStubSlot({ n: 1 });
    const k2 = makeStubSlot({ n: 2 });
    const bridge = new StubNicheforgeBridge({
      keys: [k1, k2],
      provider: ({ slot, prompt }) => {
        if (prompt.includes('mine patterns')) return { status: 'ok', text: REPORT_JSON };
        if (slot.id === k1.id) return { status: 'error', kind: 'rate-limited', detail: '429' };
        return { status: 'ok', text: BREAKDOWN_JSON };
      },
    });
    const result = await runResearchRun({ inputs: inputs([YT1]), provider: 'gemini' }, bridge, createRunController());
    expect(result.outcome).toBe('completed');
    if (result.outcome !== 'completed') return;
    expect(result.run.status).toBe('done');
    const slots = await bridge.listKeySlots();
    expect(slots.find((s) => s.id === k1.id)?.cooldownUntil).not.toBeNull();
  });

  it('fails ALL_KEYS_EXHAUSTED when every key is quota-exhausted', async () => {
    const bridge = new StubNicheforgeBridge({
      keys: [makeStubSlot({ n: 1 }), makeStubSlot({ n: 2 })],
      provider: () => ({ status: 'error', kind: 'quota-exhausted', detail: 'quota' }),
    });
    const result = await runResearchRun({ inputs: inputs([YT1]), provider: 'gemini' }, bridge, createRunController());
    expect(result.outcome).toBe('completed');
    if (result.outcome !== 'completed') return;
    expect(result.run.videos[0].failureReason).toBe('ALL_KEYS_EXHAUSTED');
    expect(result.run.status).toBe('failed');
  });

  it('flags metadata-only breakdowns low-confidence, never transcript-based', async () => {
    const bridge = new StubNicheforgeBridge({
      provider: defaultProviderHandler,
      videos: {
        [YT1]: {
          metadata: { title: 'No captions', uploader: null, durationSeconds: 30, thumbnailUrl: null },
          subtitles: { manual: [], automatic: [] },
          subtitleText: null,
        },
      },
    });
    const result = await runResearchRun({ inputs: inputs([YT1]), provider: 'gemini' }, bridge, createRunController());
    expect(result.outcome).toBe('completed');
    if (result.outcome !== 'completed') return;
    expect(result.run.videos[0].breakdown?.transcriptAvailable).toBe(false);
    expect(result.run.videos[0].breakdown?.confidence).toBe('low');
    expect(result.run.report?.coverage.metadataOnly).toBe(1);
  });

  it('cancelling mid-run marks the run cancelled and keeps the record', async () => {
    const controller = createRunController();
    const bridge = new StubNicheforgeBridge({
      provider: ({ prompt }) => {
        if (prompt.includes('mine patterns')) return { status: 'ok', text: REPORT_JSON };
        controller.cancel();
        return { status: 'ok', text: BREAKDOWN_JSON };
      },
    });
    const result = await runResearchRun({ inputs: inputs([YT1, TT1]), provider: 'gemini' }, bridge, controller);
    expect(result.outcome).toBe('completed');
    if (result.outcome !== 'completed') return;
    expect(result.run.status).toBe('cancelled');
    expect(result.run.completedAt).not.toBeNull();
    // A pre-cancelled run also lands cancelled, not failed.
    const preCancelled = createRunController();
    preCancelled.cancel();
    const second = await runResearchRun({ inputs: inputs([YT1]), provider: 'gemini' }, bridge, preCancelled);
    expect(second.outcome).toBe('completed');
    if (second.outcome !== 'completed') return;
    expect(second.run.status).toBe('cancelled');
  });

  it('refuses to start with no keys, a missing binary, or a full store', async () => {
    const noKeys = new StubNicheforgeBridge({ keys: [], provider: defaultProviderHandler });
    const r1 = await runResearchRun({ inputs: inputs([YT1]), provider: 'gemini' }, noKeys, createRunController());
    expect(r1.outcome).toBe('gate-failed');

    const noBinary = new StubNicheforgeBridge({ binaryReady: false, provider: defaultProviderHandler });
    const r2 = await runResearchRun({ inputs: inputs([YT1]), provider: 'gemini' }, noBinary, createRunController());
    expect(r2.outcome).toBe('gate-failed');

    const full = new StubNicheforgeBridge({ provider: defaultProviderHandler });
    for (let i = 0; i < 200; i += 1) {
      full.index.push({ id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, title: 'Old', status: 'done', createdAt: '2026-10-24T00:00:00Z', videoCount: 1, successCount: 1 });
    }
    const r3 = await runResearchRun({ inputs: inputs([YT1]), provider: 'gemini' }, full, createRunController());
    expect(r3.outcome).toBe('gate-failed');
    if (r3.outcome === 'gate-failed') expect(r3.reason).toBe('STORAGE_FAILED');
  });
});
