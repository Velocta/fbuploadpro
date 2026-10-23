import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { QueryClient } from '@tanstack/react-query';
import {
  createServerQueryClient,
  fetchServerFirst,
  getServerBaseUrl,
  prefetchServerQueries,
  serverApiFetch,
} from '@/lib/data/server';
import { ApiError } from '@/lib/api/errors';
import { resetReportErrorTransport, setReportErrorTransport } from '@/lib/report-error';
import { queryKeys } from '@/lib/data/query-keys';

const headersState = vi.hoisted(() => ({ mode: 'ok' as 'ok' | 'throw' }));
vi.mock('next/headers', () => ({
  cookies: async () => {
    if (headersState.mode === 'throw') {
      throw new Error('called outside a request scope');
    }
    return { toString: () => 'fbup_session=abc123; fbup_theme=dark' };
  },
}));

const WidgetSchema = z.object({ id: z.string(), label: z.string() });

function mockResponse(status: number, body: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function jsonResponse(body: unknown, status = 200) {
  return mockResponse(status, JSON.stringify(body));
}

function fetchReturning(response: Response) {
  return vi.fn().mockResolvedValue(response) as unknown as typeof fetch &
    ReturnType<typeof vi.fn>;
}

async function captureError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error('Expected the call to throw, but it resolved');
}

const ENV_KEYS = ['NEXT_PUBLIC_APP_URL', 'VERCEL_URL'] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  resetReportErrorTransport();
  vi.restoreAllMocks();
});

describe('getServerBaseUrl', () => {
  it('prefers NEXT_PUBLIC_APP_URL and strips trailing slashes', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com///';
    expect(getServerBaseUrl()).toBe('https://app.example.com');
  });

  it('falls back to VERCEL_URL with an https origin', () => {
    process.env.VERCEL_URL = 'preview.example.vercel.app';
    expect(getServerBaseUrl()).toBe('https://preview.example.vercel.app');
  });

  it('defaults to localhost', () => {
    expect(getServerBaseUrl()).toBe('http://localhost:3000');
  });
});

describe('serverApiFetch (spec 137 §3.2.4 server variant)', () => {
  it('builds an absolute URL, forwards cookies, parses + validates the response', async () => {
    const fetchFn = fetchReturning(jsonResponse({ id: 'w1', label: 'One' }));
    const result = await serverApiFetch('/api/widgets', {
      schema: WidgetSchema,
      fetchFn,
      baseUrl: 'https://srv.test',
      cookieHeader: 'fbup_session=tok123',
    });
    expect(result).toEqual({ id: 'w1', label: 'One' });
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://srv.test/api/widgets');
    expect(init.method).toBe('GET');
    expect(init.headers).toEqual({
      Accept: 'application/json',
      Cookie: 'fbup_session=tok123',
    });
  });

  it('adds a leading slash, merges custom headers, and defaults to the env base URL', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://env.test';
    const fetchFn = fetchReturning(jsonResponse({ ok: true }));
    await serverApiFetch('api/things', {
      fetchFn,
      cookieHeader: '',
      headers: { 'X-Trace': 't-1' },
    });
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://env.test/api/things');
    expect(init.headers).toEqual({ Accept: 'application/json', 'X-Trace': 't-1' });
  });

  it('passes absolute URLs through untouched', async () => {
    const fetchFn = fetchReturning(jsonResponse({ ok: true }));
    await serverApiFetch('https://other.test/abs', { fetchFn, cookieHeader: 'a=b' });
    expect(fetchFn.mock.calls[0]?.[0]).toBe('https://other.test/abs');
  });

  it('POSTs a JSON body with Content-Type when a body is given', async () => {
    const fetchFn = fetchReturning(jsonResponse({ ok: true }));
    await serverApiFetch('/api/things', {
      fetchFn,
      cookieHeader: 'a=b',
      body: { name: 'n' },
    });
    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ name: 'n' }));
    expect((init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json'
    );
  });

  it('passes a non-JSON body through without a JSON Content-Type', async () => {
    const fetchFn = fetchReturning(jsonResponse({ ok: true }));
    await serverApiFetch('/api/raw', {
      fetchFn,
      cookieHeader: 'a=b',
      method: 'PUT',
      body: 'raw-text',
    });
    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('PUT');
    expect(init.body).toBe('raw-text');
    expect(
      (init.headers as Record<string, string>)['Content-Type']
    ).toBeUndefined();
  });

  it('forwards the AbortSignal and maps an abort rejection to the aborted kind', async () => {
    const controller = new AbortController();
    const abortError = new Error('stopped');
    abortError.name = 'AbortError';
    const fetchFn = vi.fn().mockRejectedValue(abortError) as unknown as typeof fetch;
    const error = await captureError(
      serverApiFetch('/api/x', { fetchFn, cookieHeader: 'a=b', signal: controller.signal })
    );
    expect(error.kind).toBe('aborted');
    const [, init] = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(init.signal).toBe(controller.signal);
  });

  it('maps a rejected fetch to the network kind', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('socket closed')) as unknown as typeof fetch;
    const error = await captureError(
      serverApiFetch('/api/x', { fetchFn, cookieHeader: 'a=b' })
    );
    expect(error.kind).toBe('network');
  });

  it('maps a body-read failure to the network kind', async () => {
    const response = {
      ok: true,
      status: 200,
      text: vi.fn().mockRejectedValue(new Error('stream died')),
    } as unknown as Response;
    const error = await captureError(
      serverApiFetch('/api/x', { fetchFn: fetchReturning(response), cookieHeader: 'a=b' })
    );
    expect(error.kind).toBe('network');
  });

  it('throws session-expired on 401 and never touches the client redirect handler', async () => {
    const fetchFn = fetchReturning(jsonResponse({ error: 'Unauthorized' }, 401));
    const error = await captureError(
      serverApiFetch('/api/x', { fetchFn, cookieHeader: 'a=b' })
    );
    expect(error.kind).toBe('session-expired');
    expect(error.status).toBe(401);
  });

  it('maps other non-2xx responses to http errors with the server code/message', async () => {
    const fetchFn = fetchReturning(
      jsonResponse({ error: 'Nope', message: 'It broke', code: 'BROKEN' }, 500)
    );
    const error = await captureError(
      serverApiFetch('/api/x', { fetchFn, cookieHeader: 'a=b' })
    );
    expect(error.kind).toBe('http');
    expect(error.status).toBe(500);
    expect(error.message).toBe('It broke');
    expect(error.code).toBe('BROKEN');
  });

  it('derives the code from the error field when only error+message are sent', async () => {
    const fetchFn = fetchReturning(jsonResponse({ error: 'TEAPOT', message: 'short' }, 418));
    const error = await captureError(
      serverApiFetch('/api/x', { fetchFn, cookieHeader: 'a=b' })
    );
    expect(error.code).toBe('TEAPOT');
    expect(error.message).toBe('short');
  });

  it('falls back to a status message for non-object error bodies', async () => {
    const fetchFn = fetchReturning(mockResponse(502, JSON.stringify('just a string')));
    const error = await captureError(
      serverApiFetch('/api/x', { fetchFn, cookieHeader: 'a=b' })
    );
    expect(error.message).toBe('Request failed with status 502');
    expect(error.code).toBeUndefined();
  });

  it('returns unvalidated parsed JSON when no schema is given', async () => {
    const fetchFn = fetchReturning(jsonResponse({ any: ['shape'] }));
    await expect(
      serverApiFetch('/api/x', { fetchFn, cookieHeader: 'a=b' })
    ).resolves.toEqual({ any: ['shape'] });
  });

  it('returns undefined for an empty body without a schema', async () => {
    const fetchFn = fetchReturning(mockResponse(204, ''));
    await expect(
      serverApiFetch('/api/x', { fetchFn, cookieHeader: 'a=b' })
    ).resolves.toBeUndefined();
  });

  it('reports + throws a parse error for an empty body when a schema is required', async () => {
    const reported: unknown[] = [];
    setReportErrorTransport((error) => {
      reported.push(error);
    });
    const error = await captureError(
      serverApiFetch('/api/x', {
        fetchFn: fetchReturning(mockResponse(200, '')),
        cookieHeader: 'a=b',
        schema: WidgetSchema,
      })
    );
    expect(error.kind).toBe('parse');
    expect(reported).toHaveLength(1);
  });

  it('reports + throws a parse error for invalid JSON', async () => {
    const reported: unknown[] = [];
    setReportErrorTransport((error) => {
      reported.push(error);
    });
    const error = await captureError(
      serverApiFetch('/api/x', {
        fetchFn: fetchReturning(mockResponse(200, '{not json')),
        cookieHeader: 'a=b',
      })
    );
    expect(error.kind).toBe('parse');
    expect(reported).toHaveLength(1);
  });

  it('reports + throws a parse error on a schema mismatch', async () => {
    const reported: unknown[] = [];
    setReportErrorTransport((error) => {
      reported.push(error);
    });
    const error = await captureError(
      serverApiFetch('/api/x', {
        fetchFn: fetchReturning(jsonResponse({ id: 42, label: 'x' })),
        cookieHeader: 'a=b',
        schema: WidgetSchema,
      })
    );
    expect(error.kind).toBe('parse');
    expect(error.issues).toBeDefined();
    expect(reported).toHaveLength(1);
  });

  it('forwards the request cookies when no cookie header is injected', async () => {
    headersState.mode = 'ok';
    const fetchFn = fetchReturning(jsonResponse({ ok: true }));
    await serverApiFetch('/api/x', { fetchFn });
    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Cookie).toBe(
      'fbup_session=abc123; fbup_theme=dark'
    );
  });

  it('reports through the seam and proceeds without cookies when the store is unavailable', async () => {
    headersState.mode = 'throw';
    const reported: unknown[] = [];
    setReportErrorTransport((error) => {
      reported.push(error);
    });
    const fetchFn = fetchReturning(jsonResponse({ ok: true }));
    await serverApiFetch('/api/x', { fetchFn });
    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Cookie).toBeUndefined();
    expect(reported).toHaveLength(1);
    headersState.mode = 'ok';
  });
});

describe('fetchServerFirst (preference order, spec §3.2.4)', () => {
  it('prefers the lib/server function over the API round-trip', async () => {
    const fetchFn = fetchReturning(jsonResponse({ id: 'api', label: 'api' }));
    const serverFn = vi.fn().mockResolvedValue({ id: 'fn', label: 'fn' });
    const result = await fetchServerFirst({
      serverFn,
      path: '/api/widgets',
      schema: WidgetSchema,
      fetchOptions: { fetchFn, cookieHeader: 'a=b' },
    });
    expect(result).toEqual({ id: 'fn', label: 'fn' });
    expect(serverFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('falls back to the cookie-forwarding variant when no server function exists', async () => {
    const fetchFn = fetchReturning(jsonResponse({ id: 'api', label: 'api' }));
    const result = await fetchServerFirst({
      path: '/api/widgets',
      schema: WidgetSchema,
      fetchOptions: { fetchFn, cookieHeader: 'a=b' },
    });
    expect(result).toEqual({ id: 'api', label: 'api' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('throws when neither a server function nor a path is given', async () => {
    await expect(fetchServerFirst({ schema: WidgetSchema })).rejects.toThrow(
      'fetchServerFirst requires either a serverFn (preferred) or a path.'
    );
  });
});

describe('server prefetch + dehydration hand-off', () => {
  it('creates a fresh server client with the specced defaults', () => {
    const a = createServerQueryClient('acme');
    const b = createServerQueryClient('acme');
    expect(a).toBeInstanceOf(QueryClient);
    expect(a).not.toBe(b);
    expect(a.getDefaultOptions().queries?.staleTime).toBe(60_000);
  });

  it('prefetches entries in parallel and dehydrates their data', async () => {
    const client = createServerQueryClient('acme');
    const tenant = queryKeys.tenant('acme');
    const order: string[] = [];
    const state = await prefetchServerQueries(client, [
      {
        queryKey: tenant.pages.list,
        queryFn: async () => {
          order.push('pages');
          return [{ id: 'p1' }];
        },
      },
      {
        queryKey: tenant.accounts.list,
        queryFn: async () => {
          order.push('accounts');
          return [{ id: 'a1' }];
        },
      },
    ]);
    expect(order).toEqual(expect.arrayContaining(['pages', 'accounts']));
    expect(state.queries).toHaveLength(2);
    const byKey = new Map(
      state.queries.map((q) => [JSON.stringify(q.queryKey), q.state.data])
    );
    expect(byKey.get(JSON.stringify(tenant.pages.list))).toEqual([{ id: 'p1' }]);
    expect(byKey.get(JSON.stringify(tenant.accounts.list))).toEqual([{ id: 'a1' }]);
  });

  it('dehydrates only successful prefetches (a failed entry does not sink the route)', async () => {
    const client = createServerQueryClient('acme');
    const tenant = queryKeys.tenant('acme');
    const state = await prefetchServerQueries(client, [
      { queryKey: tenant.pages.list, queryFn: async () => [{ id: 'p1' }] },
      {
        queryKey: tenant.media.list,
        queryFn: async () => {
          throw new Error('boom');
        },
      },
    ]);
    expect(state.queries).toHaveLength(1);
    expect(state.queries[0]?.queryKey).toEqual(tenant.pages.list);
  });
});
