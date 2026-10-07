import type { SessionPayload } from '../../src/domain/session';

export const TEST_SESSION_SECRET = 'super-secret-test-key-minimum-32-chars-long!';

export const mockUserSession: SessionPayload = {
  userId: '11111111-1111-4111-a111-111111111111',
  email: 'client@example.com',
  name: 'Acme Client',
  subdomain: 'acme',
  role: 'user',
  status: 'active',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 86400,
};

export const mockSellerSession: SessionPayload = {
  userId: '22222222-2222-4222-a222-222222222222',
  email: 'seller@example.com',
  name: 'Seller Partner',
  subdomain: 'agency-seller',
  role: 'seller',
  status: 'active',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 86400,
};

export const mockAdminSession: SessionPayload = {
  userId: '33333333-3333-4333-a333-333333333333',
  email: 'admin@fbuploadpro.com',
  name: 'System Admin',
  subdomain: 'platform-admin',
  role: 'admin',
  status: 'active',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 86400,
};

export const mockSuspendedSession: SessionPayload = {
  userId: '44444444-4444-4444-a444-444444444444',
  email: 'suspended@example.com',
  name: 'Suspended Account',
  subdomain: 'suspended-org',
  role: 'user',
  status: 'suspended',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 86400,
};
