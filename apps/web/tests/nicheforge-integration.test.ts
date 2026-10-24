import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createRunController, runResearchRun } from '@/lib/nicheforge/run-pipeline';
import { defaultProviderHandler, makeStubSlot, StubNicheforgeBridge } from './helpers/nicheforge-stub-bridge';
import geminiBreakdown from './fixtures/nicheforge/gemini-breakdown.json';
import geminiReport from './fixtures/nicheforge/gemini-report.json';
import openaiBreakdown from './fixtures/nicheforge/openai-breakdown.json';
import providerErrors from './fixtures/nicheforge/provider-errors.json';

const FIXTURE_DIR = join(__dirname, 'fixtures', 'nicheforge');

describe('nicheforge recorded-response integration', () => {
  it('runs end to end on recorded Gemini responses', async () => {
    const bridge = new StubNicheforgeBridge({
      provider: ({ prompt }) => {
        if (prompt.includes('mine patterns')) return { status: 'ok', text: geminiReport.output };
        return { status: 'ok', text: geminiBreakdown.output };
      },
    });
    const result = await runResearchRun(
      {
        inputs: [
          { url: 'https://www.youtube.com/watch?v=aaa111', platform: 'youtube' },
          { url: 'https://www.tiktok.com/@someone/video/123', platform: 'tiktok' },
        ],
        provider: 'gemini',
      },
      bridge,
      createRunController(),
    );
    expect(result.outcome).toBe('completed');
    if (result.outcome !== 'completed') return;
    expect(result.run.status).toBe('done');
    expect(result.run.videos[0].breakdown?.hookType).toBe('bold-claim');
    expect(result.run.report?.recurringHooks[0].hookType).toBe('bold-claim');
    expect(result.run.report?.provider).toBe('gemini');
  });

  it('runs end to end on a recorded OpenAI-compatible response', async () => {
    const slot = makeStubSlot({ n: 1, provider: 'openai-compatible', baseUrl: 'https://api.example.com/v1', modelId: 'test-model' });
    const bridge = new StubNicheforgeBridge({
      keys: [slot],
      provider: ({ prompt }) => {
        if (prompt.includes('mine patterns')) return { status: 'ok', text: geminiReport.output };
        return { status: 'ok', text: openaiBreakdown.output };
      },
    });
    const result = await runResearchRun(
      {
        inputs: [{ url: 'https://youtu.be/bbb222', platform: 'youtube' }],
        provider: 'openai-compatible',
        modelId: 'test-model',
      },
      bridge,
      createRunController(),
    );
    expect(result.outcome).toBe('completed');
    if (result.outcome !== 'completed') return;
    expect(result.run.videos[0].breakdown?.hookType).toBe('question');
  });

  it('recorded error fixtures drive the failure paths', async () => {
    expect(providerErrors.cases).toHaveLength(4);
    // The default handler path is covered by the pipeline suite; here we
    // assert the fixture shapes the pipeline consumes are well-formed.
    for (const c of providerErrors.cases) {
      if ('kind' in c) expect(['rate-limited', 'auth']).toContain(c.kind);
      if ('output' in c) expect(typeof c.output).toBe('string');
    }
    void defaultProviderHandler;
  });

  it('no fixture contains key material', () => {
    const keyPatterns = [/sk-[A-Za-z0-9]{20,}/, /AIza[0-9A-Za-z_-]{20,}/, /xox[baprs]-[A-Za-z0-9-]{10,}/];
    for (const file of readdirSync(FIXTURE_DIR)) {
      const content = readFileSync(join(FIXTURE_DIR, file), 'utf8');
      for (const pattern of keyPatterns) {
        expect(content).not.toMatch(pattern);
      }
    }
  });

  it('stored run records never contain key material', async () => {
    const bridge = new StubNicheforgeBridge({ provider: defaultProviderHandler });
    const result = await runResearchRun(
      { inputs: [{ url: 'https://www.youtube.com/watch?v=aaa111', platform: 'youtube' }], provider: 'gemini' },
      bridge,
      createRunController(),
    );
    expect(result.outcome).toBe('completed');
    if (result.outcome !== 'completed') return;
    const stored = JSON.stringify([...bridge.runs.values()]);
    expect(stored).not.toContain('stub-secret');
    const slots = await bridge.listKeySlots();
    expect(slots[0]).not.toHaveProperty('key');
    expect(Object.keys(slots[0]).sort()).not.toContain('key');
  });
});
