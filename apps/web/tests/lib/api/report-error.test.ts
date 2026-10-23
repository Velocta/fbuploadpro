import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  reportError,
  resetReportErrorTransport,
  setReportErrorTransport,
} from '@/lib/report-error';

describe('reportError seam', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    resetReportErrorTransport();
    consoleErrorSpy.mockRestore();
  });

  it('reports through the default console transport with its source', () => {
    const error = new Error('Boundary blew up');
    reportError(error, { source: 'error-boundary' });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[reportError]',
      'error-boundary',
      error,
      { source: 'error-boundary' }
    );
  });

  it('defaults the source label when no context is given', () => {
    const error = new Error('No context');
    reportError(error);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[reportError]',
      'unknown',
      error,
      undefined
    );
  });

  it('routes through a transport installed behind the seam', () => {
    const transport = vi.fn();
    setReportErrorTransport(transport);
    const error = new Error('To PostHog one day');
    reportError(error, { source: 'api-client', path: '/api/workspaces' });
    expect(transport).toHaveBeenCalledWith(error, {
      source: 'api-client',
      path: '/api/workspaces',
    });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('never throws when the transport itself fails', () => {
    const transportError = new Error('Transport down');
    setReportErrorTransport(() => {
      throw transportError;
    });
    expect(() => reportError(new Error('Original'))).not.toThrow();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[reportError] transport failed',
      transportError
    );
  });

  it('reset restores the default transport after a custom one', () => {
    const transport = vi.fn();
    setReportErrorTransport(transport);
    resetReportErrorTransport();
    reportError(new Error('Back to default'), { source: 'test' });
    expect(transport).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });
});
