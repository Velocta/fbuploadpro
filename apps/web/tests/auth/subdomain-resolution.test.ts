import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveUniqueSubdomain, _setMockSupabaseClient } from '@/lib/supabase-auth';

describe('resolveUniqueSubdomain (ISSUE-08)', () => {
  afterEach(() => {
    _setMockSupabaseClient(null);
    vi.restoreAllMocks();
  });

  it('resolves unique subdomain in a single query using ilike instead of an N+1 loop', async () => {
    const ilikeSpy = vi.fn().mockImplementation((col: string, pattern: string) => {
      // Mock existing workspaces returned by ilike
      return Promise.resolve({
        data: [
          { subdomain: 'alex' },
          { subdomain: 'alex1' },
          { subdomain: 'alex2' },
          { subdomain: 'alex9' },
          { subdomain: 'alexandra' },
        ],
        error: null,
      });
    });

    const eqSpy = vi.fn();

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'workspaces') {
          return {
            select: vi.fn().mockReturnValue({
              ilike: ilikeSpy,
              eq: eqSpy,
            }),
          };
        }
        return {};
      }),
    };

    _setMockSupabaseClient(mockSupabase as any);

    const resolved = await resolveUniqueSubdomain('alex');

    // Should resolve to alex3 since alex, alex1, alex2 are taken
    expect(resolved).toBe('alex3');

    // Must query via single batched ilike call, NOT sequential N+1 eq loops
    expect(ilikeSpy).toHaveBeenCalledTimes(1);
    expect(ilikeSpy).toHaveBeenCalledWith('subdomain', 'alex%');
    expect(eqSpy).not.toHaveBeenCalled();
  });

  it('returns baseSubdomain directly when no collisions exist', async () => {
    const ilikeSpy = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => ({
        select: vi.fn().mockReturnValue({
          ilike: ilikeSpy,
        }),
      })),
    };

    _setMockSupabaseClient(mockSupabase as any);

    const resolved = await resolveUniqueSubdomain('newbrand');
    expect(resolved).toBe('newbrand');
    expect(ilikeSpy).toHaveBeenCalledTimes(1);
    expect(ilikeSpy).toHaveBeenCalledWith('subdomain', 'newbrand%');
  });

  it('safely falls back to baseSubdomain if PostgREST query returns an error', async () => {
    const ilikeSpy = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Database connection failed' },
    });

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => ({
        select: vi.fn().mockReturnValue({
          ilike: ilikeSpy,
        }),
      })),
    };

    _setMockSupabaseClient(mockSupabase as any);

    const resolved = await resolveUniqueSubdomain('fallbackbrand');
    expect(resolved).toBe('fallbackbrand');
    expect(ilikeSpy).toHaveBeenCalledTimes(1);
  });
});
