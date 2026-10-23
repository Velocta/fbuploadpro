import { describe, expect, it } from 'vitest';
import {
  ApiError,
  abortedError,
  getErrorMessage,
  httpError,
  isApiError,
  networkError,
  parseError,
  sessionExpiredError,
} from '@/lib/api/errors';

describe('ApiError taxonomy', () => {
  it('carries kind, status, code, issues and cause', () => {
    const cause = new Error('root');
    const error = new ApiError('http', 'Boom', {
      status: 500,
      code: 'INTERNAL',
      issues: [{ path: ['name'] }],
      cause,
    });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ApiError');
    expect(error.kind).toBe('http');
    expect(error.message).toBe('Boom');
    expect(error.status).toBe(500);
    expect(error.code).toBe('INTERNAL');
    expect(error.issues).toEqual([{ path: ['name'] }]);
    expect(error.cause).toBe(cause);
  });

  it('defaults optional fields to undefined without a cause', () => {
    const error = new ApiError('network', 'Down');
    expect(error.status).toBeUndefined();
    expect(error.code).toBeUndefined();
    expect(error.issues).toBeUndefined();
    expect(error.cause).toBeUndefined();
  });

  it('httpError fixes the kind and status', () => {
    const error = httpError(404, 'Workspace not found', { code: 'NOT_FOUND' });
    expect(error.kind).toBe('http');
    expect(error.status).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Workspace not found');
  });

  it('networkError wraps the cause with a plain-language message', () => {
    const cause = new TypeError('fetch failed');
    const error = networkError(cause);
    expect(error.kind).toBe('network');
    expect(error.cause).toBe(cause);
    expect(error.message).toContain('connection');
  });

  it('parseError carries issues for schema failures', () => {
    const error = parseError('Bad shape', { issues: ['a', 'b'], status: 200 });
    expect(error.kind).toBe('parse');
    expect(error.issues).toEqual(['a', 'b']);
    expect(error.status).toBe(200);
  });

  it('sessionExpiredError is always a 401', () => {
    const error = sessionExpiredError({ code: 'Unauthorized' });
    expect(error.kind).toBe('session-expired');
    expect(error.status).toBe(401);
    expect(error.code).toBe('Unauthorized');
    expect(error.message).toContain('session expired');
  });

  it('abortedError marks cancellations, with and without a cause', () => {
    const cause = new Error('aborted');
    expect(abortedError(cause).kind).toBe('aborted');
    expect(abortedError(cause).cause).toBe(cause);
    expect(abortedError().kind).toBe('aborted');
    expect(abortedError().cause).toBeUndefined();
  });

  it('isApiError narrows only ApiError instances', () => {
    expect(isApiError(httpError(500, 'x'))).toBe(true);
    expect(isApiError(new Error('x'))).toBe(false);
    expect(isApiError('x')).toBe(false);
    expect(isApiError(null)).toBe(false);
  });
});

describe('getErrorMessage (unknown narrowing)', () => {
  it('returns a non-empty string as-is', () => {
    expect(getErrorMessage('Direct message')).toBe('Direct message');
  });

  it('falls back for empty and whitespace strings', () => {
    expect(getErrorMessage('')).toBe('Something went wrong. Please try again.');
    expect(getErrorMessage('   ')).toBe('Something went wrong. Please try again.');
  });

  it('returns an Error message', () => {
    expect(getErrorMessage(new Error('Kaput'))).toBe('Kaput');
  });

  it('falls back for an Error with an empty message', () => {
    expect(getErrorMessage(new Error(''))).toBe(
      'Something went wrong. Please try again.'
    );
  });

  it('reads a string message property off a plain object', () => {
    expect(getErrorMessage({ message: 'From a payload' })).toBe('From a payload');
  });

  it('falls back when the message property is not a usable string', () => {
    expect(getErrorMessage({ message: '' })).toBe(
      'Something went wrong. Please try again.'
    );
    expect(getErrorMessage({ message: 42 })).toBe(
      'Something went wrong. Please try again.'
    );
    expect(getErrorMessage({ other: 'x' })).toBe(
      'Something went wrong. Please try again.'
    );
  });

  it('falls back for null, undefined, numbers and booleans', () => {
    expect(getErrorMessage(null)).toBe('Something went wrong. Please try again.');
    expect(getErrorMessage(undefined)).toBe('Something went wrong. Please try again.');
    expect(getErrorMessage(42)).toBe('Something went wrong. Please try again.');
    expect(getErrorMessage(true)).toBe('Something went wrong. Please try again.');
  });

  it('honours a custom fallback', () => {
    expect(getErrorMessage(null, 'Custom fallback')).toBe('Custom fallback');
    expect(getErrorMessage(new ApiError('http', 'Typed'))).toBe('Typed');
  });
});
