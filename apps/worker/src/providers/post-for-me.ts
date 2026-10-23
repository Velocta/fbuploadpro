// ==========================================
// Post for Me provider client base (spec 125; shared with spec 126)
// ==========================================
//
// THE shared transport for every Post for Me platform module. This
// file is deliberately platform-free: Bearer API-key auth, JSON
// request/response handling, and one error type. Platform modules
// (YouTube here, TikTok in spec 126) build their own calls on top and
// own every platform field — nothing YouTube- or TikTok-shaped may
// be added here.
//
// Built strictly to Post for Me's public API documentation
// (api.postforme.dev): base URL `https://api.postforme.dev/v1`,
// `Authorization: Bearer <api key>` on every request. The API key
// lives only in worker env (POST_FOR_ME_API_KEY, wired through
// GitHub Secrets — see .github/workflows/deploy-worker.yml); it is
// never stored in the database and never sent anywhere else.

export const POST_FOR_ME_PROVIDER_NAME = 'post-for-me';

export const POST_FOR_ME_DEFAULT_BASE_URL = 'https://api.postforme.dev/v1';

export interface PostForMeClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Any non-2xx response from Post for Me. `providerCode` /
 * `providerMessage` preserve the provider's own error vocabulary so
 * publishers can record it in `publish_logs.detail` instead of
 * flattening it away; `body` is the parsed response body (or the raw
 * text when it was not JSON).
 */
export class PostForMeError extends Error {
  readonly status: number;
  readonly providerCode: string | null;
  readonly providerMessage: string;
  readonly body: unknown;

  constructor(params: {
    status: number;
    providerCode: string | null;
    providerMessage: string;
    body: unknown;
  }) {
    super(params.providerMessage);
    this.name = 'PostForMeError';
    this.status = params.status;
    this.providerCode = params.providerCode;
    this.providerMessage = params.providerMessage;
    this.body = params.body;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function extractProviderError(body: unknown, status: number): {
  providerCode: string | null;
  providerMessage: string;
} {
  const record = asRecord(body);
  if (record) {
    const nested = asRecord(record.error);
    const codeValue =
      record.code ?? record.error_code ?? nested?.code ?? nested?.error_code;
    const messageValue =
      record.message ??
      record.error_message ??
      (typeof record.error === 'string' ? record.error : undefined) ??
      nested?.message;
    return {
      providerCode:
        typeof codeValue === 'string' || typeof codeValue === 'number'
          ? String(codeValue)
          : null,
      providerMessage:
        typeof messageValue === 'string' && messageValue.length > 0
          ? messageValue
          : `Post for Me request failed with status ${status}`,
    };
  }
  if (typeof body === 'string' && body.length > 0) {
    return { providerCode: null, providerMessage: body };
  }
  return {
    providerCode: null,
    providerMessage: `Post for Me request failed with status ${status}`,
  };
}

export class PostForMeClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: PostForMeClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? POST_FOR_ME_DEFAULT_BASE_URL).replace(
      /\/+$/,
      ''
    );
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /**
   * One JSON request against the provider API. Returns the parsed
   * body on 2xx; throws PostForMeError on any non-2xx. Transport
   * failures (DNS, timeouts) propagate as thrown by fetch — callers
   * classify them.
   */
  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const response = await this.fetchImpl(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    const text = await response.text();
    let parsed: unknown = null;
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        parsed = text;
      }
    }

    if (!response.ok) {
      const { providerCode, providerMessage } = extractProviderError(
        parsed,
        response.status
      );
      throw new PostForMeError({
        status: response.status,
        providerCode,
        providerMessage,
        body: parsed,
      });
    }
    return parsed as T;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }
}
