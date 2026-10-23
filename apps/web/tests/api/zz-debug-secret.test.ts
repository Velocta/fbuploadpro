import { describe, expect, it } from 'vitest';
import { getSessionSecret } from '@fbuploadpro/contracts';
import {
  createConnectStatePayload,
  signConnectState,
  verifyConnectState,
} from '@/lib/connect/state';

const TEST_SECRET = 'test-secret-for-tiktok-connect-tests-0123456789';

describe('debug', () => {
  it('secret roundtrip', async () => {
    process.env.SESSION_SECRET = <redacted>
    const fromEnv = getSessionSecret();
    console.log('env secret length:', process.env.SESSION_SECRET?.length);
    console.log('getSessionSecret length:', fromEnv.length);
    console.log('secrets equal:', fromEnv === TEST_SECRET);
    console.log('TEST_SECRET length:', TEST_SECRET.length);
    const state = await signConnectState(
      createConnectStatePayload({
        workspaceId: '22222222-2222-4222-a222-222222222222',
        tenantSubdomain: 'acme',
        userId: '11111111-1111-4111-a111-111111111111',
        platform: 'tiktok',
      }),
      TEST_SECRET
    );
    const payload = await verifyConnectState(state, getSessionSecret());
    console.log('verified platform:', payload.platform);
    expect(payload.platform).toBe('tiktok');
  });
});
