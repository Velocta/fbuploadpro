import { describe, expect, it } from 'vitest';
import {
  ApiError,
  api,
  apiFetch,
  apiSchemas,
  buildTenantApiPath,
  getErrorMessage,
  registerSessionExpiredHandler,
} from '@/lib/api';

describe('lib/api public surface', () => {
  it('exposes the client, taxonomy, handler registration and schemas', () => {
    expect(typeof apiFetch).toBe('function');
    expect(typeof api.get).toBe('function');
    expect(typeof buildTenantApiPath).toBe('function');
    expect(typeof registerSessionExpiredHandler).toBe('function');
    expect(typeof getErrorMessage).toBe('function');
    expect(new ApiError('http', 'x').kind).toBe('http');
    expect(apiSchemas.ListWorkspacesResponseSchema).toBeDefined();
    expect(apiSchemas.ListFacebookAccountsResponseSchema).toBeDefined();
    expect(apiSchemas.MediaListResponseSchema).toBeDefined();
  });
});
