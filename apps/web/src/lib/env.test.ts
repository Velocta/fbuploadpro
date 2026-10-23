import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  REQUIRED_ENV_VARS,
  findMissingEnvVars,
  validateEnv,
} from '@/lib/env';

/** A complete, valid snapshot: every required variable set to a dummy value. */
function completeEnv(): Record<string, string> {
  return Object.fromEntries(REQUIRED_ENV_VARS.map((name) => [name, 'test-value']));
}

describe('findMissingEnvVars', () => {
  it('returns nothing when the complete required set is present', () => {
    expect(findMissingEnvVars(completeEnv())).toEqual([]);
  });

  it('names every missing variable, in required-set order', () => {
    expect(findMissingEnvVars({})).toEqual([...REQUIRED_ENV_VARS]);
  });

  it('treats empty and whitespace-only values as missing', () => {
    const env = completeEnv();
    env.SESSION_SECRET = '';
    env.POSTHOG_KEY = '   ';
    expect(findMissingEnvVars(env)).toEqual(['SESSION_SECRET', 'POSTHOG_KEY']);
  });

  it('ignores unrelated variables', () => {
    const env = { ...completeEnv(), SOMETHING_ELSE: 'x' };
    expect(findMissingEnvVars(env)).toEqual([]);
  });
});

describe('validateEnv', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it('passes with the complete set in production', () => {
    const env = { ...completeEnv(), NODE_ENV: 'production' };
    expect(validateEnv(env)).toEqual({ missing: [] });
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('throws in production naming the missing variables — names only', () => {
    const env = completeEnv();
    delete env.SUPABASE_SERVICE_ROLE_KEY;
    delete env.UPSTASH_REDIS_REST_TOKEN;
    let thrown: unknown;
    try {
      validateEnv(env, { nodeEnv: 'production' });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    const message = (thrown as Error).message;
    expect(message).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(message).toContain('UPSTASH_REDIS_REST_TOKEN');
    // Names only: no present variable's value ever leaks into the error.
    expect(message).not.toContain('test-value');
  });

  it('warns instead of throwing outside production', () => {
    const env = completeEnv();
    delete env.R2_BUCKET_NAME;
    const result = validateEnv(env, { nodeEnv: 'development' });
    expect(result).toEqual({ missing: ['R2_BUCKET_NAME'] });
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(String(consoleWarnSpy.mock.calls[0]?.[0])).toContain('R2_BUCKET_NAME');
  });

  it('defaults to the NODE_ENV of the snapshot it is given', () => {
    const env: Record<string, string> = { ...completeEnv(), NODE_ENV: 'production' };
    delete env.POSTHOG_KEY;
    expect(() => validateEnv(env)).toThrowError(/POSTHOG_KEY/);
  });
});
