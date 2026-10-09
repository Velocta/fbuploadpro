import { describe, it, expect, vi, beforeEach } from 'vitest';
import HomePage from '../../src/app/page';
import * as navigation from 'next/navigation';

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

describe('Root Page Default Redirection (User Story 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects root visitors directly to /login', () => {
    HomePage();
    expect(navigation.redirect).toHaveBeenCalledWith('/login');
  });
});
