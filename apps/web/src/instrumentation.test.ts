import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const captureServerException = vi.fn((_error: unknown, _context?: Record<string, unknown>) =>
  Promise.resolve()
);
const validateEnv = vi.fn(() => ({ missing: [] as string[] }));

vi.mock('./lib/server-analytics', () => ({ captureServerException }));
vi.mock('./lib/env', () => ({ validateEnv }));

import { register } from './instrumentation';
import {
  reportError,
  resetReportErrorTransport,
} from './lib/report-error';

describe('instrumentation register()', () => {
  const originalRuntime = process.env.NEXT_RUNTIME;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    process.env.NEXT_RUNTIME = 'nodejs';
  });

  afterEach(() => {
    resetReportErrorTransport();
    consoleErrorSpy.mockRestore();
    if (originalRuntime === undefined) {
      delete process.env.NEXT_RUNTIME;
    } else {
      process.env.NEXT_RUNTIME = originalRuntime;
    }
  });

  it('validates the environment at boot on the Node.js runtime', async () => {
    await register();
    expect(validateEnv).toHaveBeenCalledTimes(1);
  });

  it('installs the PostHog transport behind the reportError seam', async () => {
    await register();
    const error = new Error('Server blew up');
    reportError(error, { source: 'error-boundary', path: '/api/workspaces' });
    expect(captureServerException).toHaveBeenCalledWith(error, {
      source: 'error-boundary',
      path: '/api/workspaces',
    });
    // The console log the default transport provided is preserved.
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[reportError]',
      'error-boundary',
      error,
      { source: 'error-boundary', path: '/api/workspaces' }
    );
  });

  it('does nothing on the Edge runtime', async () => {
    process.env.NEXT_RUNTIME = 'edge';
    await register();
    expect(validateEnv).not.toHaveBeenCalled();
    reportError(new Error('Edge error'), { source: 'test' });
    expect(captureServerException).not.toHaveBeenCalled();
  });
});
