import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  captureWorkerError,
  captureWorkerEvent,
  POSTHOG_CAPTURE_TIMEOUT_MS,
} from '../src/analytics.js';

describe('captureWorkerError — PostHog capture timeout (spec 139)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('no-ops without a PostHog key and never calls fetch', () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    captureWorkerError({}, new Error('boom'));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the capture with an AbortSignal timeout', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    let captured: Promise<unknown> | undefined;
    captureWorkerError({ POSTHOG_KEY: 'phc_test_key' }, new Error('boom'), { site: 'test' }, (p) => {
      captured = p;
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [unknown, RequestInit];
    expect(String(url)).toBe('https://us.i.posthog.com/capture/');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(POSTHOG_CAPTURE_TIMEOUT_MS).toBe(5_000);
    await captured;
  });

  it(
    'a hanging PostHog endpoint cannot hang the capture — the 5s timeout aborts it and the error is swallowed',
    async () => {
      const fetchMock = vi.fn(
        (_url: unknown, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            const signal = init?.signal;
            if (!signal) {
              reject(new Error('fetch was called without a signal'));
              return;
            }
            signal.addEventListener('abort', () => reject(signal.reason), { once: true });
          })
      );
      vi.stubGlobal('fetch', fetchMock);

      let captured: Promise<unknown> | undefined;
      captureWorkerError({ POSTHOG_KEY: 'phc_test_key' }, new Error('boom'), {}, (p) => {
        captured = p;
      });

      // Without the timeout this await never settles; with it, the hanging
      // fetch aborts at ~5s and capture resolves (telemetry errors swallowed).
      await expect(captured).resolves.toBeUndefined();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
    15_000
  );
});

describe('captureWorkerEvent — named operational events (spec 139 residue)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('no-ops without a PostHog key and never calls fetch', () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    captureWorkerEvent({}, 'refresh_backlog_beyond_cap', { scanned: 500 });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts the named event (not $exception) with its properties on the worker identity', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    let captured: Promise<unknown> | undefined;
    captureWorkerEvent(
      { POSTHOG_KEY: 'phc_test_key' },
      'refresh_backlog_beyond_cap',
      { scanned: 500, scanCap: 500 },
      (p) => {
        captured = p;
      }
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [unknown, RequestInit];
    expect(String(url)).toBe('https://us.i.posthog.com/capture/');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(String(init.body)) as {
      event: string;
      distinct_id: string;
      properties: Record<string, unknown>;
    };
    expect(body.event).toBe('refresh_backlog_beyond_cap');
    expect(body.distinct_id).toBe('worker');
    expect(body.properties).toMatchObject({ scanned: 500, scanCap: 500 });
    await captured;
  });
});
