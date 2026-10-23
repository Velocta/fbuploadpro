import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_FETCH_TIMEOUT_MS,
  GRAPH_API_TIMEOUT_MS,
  MEDIA_FETCH_TIMEOUT_MS,
  composeTimeoutSignal,
  fetchWithTimeout,
  fetchWithTimeoutToHeaders,
} from '@/lib/http/fetch-with-timeout';

function capturingFetch(response = new Response('ok', { status: 200 })) {
  const calls: Array<{ input: unknown; init: RequestInit | undefined }> = [];
  const fetchFn = vi.fn(async (input: unknown, init?: RequestInit) => {
    calls.push({ input, init });
    return response;
  }) as unknown as typeof fetch;
  return { calls, fetchFn };
}

describe('fetch-with-timeout constants', () => {
  it('exposes the Graph and media budgets from the spec', () => {
    expect(GRAPH_API_TIMEOUT_MS).toBe(30_000);
    expect(MEDIA_FETCH_TIMEOUT_MS).toBe(15_000);
    expect(DEFAULT_FETCH_TIMEOUT_MS).toBe(GRAPH_API_TIMEOUT_MS);
  });
});

describe('composeTimeoutSignal', () => {
  it('returns a fresh AbortSignal when no caller signal is given', () => {
    const signal = composeTimeoutSignal(undefined, 1_000);
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal.aborted).toBe(false);
  });

  it('propagates a caller abort to the composed signal', () => {
    const caller = new AbortController();
    const signal = composeTimeoutSignal(caller.signal, 60_000);
    caller.abort();
    expect(signal.aborted).toBe(true);
  });
});

describe('fetchWithTimeout', () => {
  it('calls the underlying fetch with a composed timeout signal', async () => {
    const { calls, fetchFn } = capturingFetch();
    const res = await fetchWithTimeout(
      'https://graph.facebook.com/v26.0/me',
      { method: 'GET', headers: { Authorization: 'Bearer token' } },
      GRAPH_API_TIMEOUT_MS,
      fetchFn
    );
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.input).toBe('https://graph.facebook.com/v26.0/me');
    expect(calls[0]?.init?.method).toBe('GET');
    expect(calls[0]?.init?.headers).toEqual({ Authorization: 'Bearer token' });
    expect(calls[0]?.init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('preserves a caller signal: aborting it aborts the request signal', async () => {
    const { calls, fetchFn } = capturingFetch();
    const caller = new AbortController();
    await fetchWithTimeout(
      'https://example.com/data',
      { signal: caller.signal },
      60_000,
      fetchFn
    );
    const requestSignal = calls[0]?.init?.signal as AbortSignal;
    expect(requestSignal).not.toBe(caller.signal);
    expect(requestSignal.aborted).toBe(false);
    caller.abort();
    expect(requestSignal.aborted).toBe(true);
  });

  it('returns non-2xx responses instead of throwing', async () => {
    const { fetchFn } = capturingFetch(new Response('nope', { status: 502 }));
    const res = await fetchWithTimeout('https://example.com/fail', {}, 1_000, fetchFn);
    expect(res.status).toBe(502);
    expect(await res.text()).toBe('nope');
  });

  it('accepts URL and Request inputs unchanged', async () => {
    const { calls, fetchFn } = capturingFetch();
    const url = new URL('https://example.com/a?b=1');
    await fetchWithTimeout(url, undefined, 1_000, fetchFn);
    expect(calls[0]?.input).toBe(url);
    const request = new Request('https://example.com/b');
    await fetchWithTimeout(request, undefined, 1_000, fetchFn);
    expect(calls[1]?.input).toBe(request);
  });

  it('propagates an underlying fetch rejection (e.g. a timeout abort)', async () => {
    const abortingFetch = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal;
      return new Promise<Response>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    }) as unknown as typeof fetch;
    await expect(
      fetchWithTimeout('https://example.com/slow', {}, 5, abortingFetch)
    ).rejects.toMatchObject({ name: 'TimeoutError' });
  });
});

describe('fetchWithTimeoutToHeaders', () => {
  it('resolves with the response and does not abort it after headers', async () => {
    vi.useFakeTimers();
    try {
      const { calls, fetchFn } = capturingFetch();
      const res = await fetchWithTimeoutToHeaders(
        'https://example.com/large-media',
        {},
        MEDIA_FETCH_TIMEOUT_MS,
        fetchFn
      );
      expect(res.status).toBe(200);
      const requestSignal = calls[0]?.init?.signal as AbortSignal;
      // Long after the time-to-headers budget, the body must still be
      // readable: the timer was cleared when the headers arrived.
      vi.advanceTimersByTime(MEDIA_FETCH_TIMEOUT_MS * 4);
      expect(requestSignal.aborted).toBe(false);
      expect(await res.text()).toBe('ok');
    } finally {
      vi.useRealTimers();
    }
  });

  it('aborts when no headers arrive within the budget', async () => {
    const hangingFetch = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal;
      return new Promise<Response>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    }) as unknown as typeof fetch;
    await expect(
      fetchWithTimeoutToHeaders('https://example.com/hung', {}, 5, hangingFetch)
    ).rejects.toThrow(/timed out/i);
  });

  it('still honours a caller abort', async () => {
    const { calls, fetchFn } = capturingFetch();
    const caller = new AbortController();
    await fetchWithTimeoutToHeaders(
      'https://example.com/media',
      { signal: caller.signal },
      60_000,
      fetchFn
    );
    const requestSignal = calls[0]?.init?.signal as AbortSignal;
    caller.abort();
    expect(requestSignal.aborted).toBe(true);
  });

  it('returns non-2xx responses instead of throwing', async () => {
    const { fetchFn } = capturingFetch(new Response('bad', { status: 404 }));
    const res = await fetchWithTimeoutToHeaders(
      'https://example.com/missing',
      {},
      1_000,
      fetchFn
    );
    expect(res.status).toBe(404);
  });
});
