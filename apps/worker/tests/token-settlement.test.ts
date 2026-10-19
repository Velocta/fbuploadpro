import { describe, expect, it, vi } from 'vitest';
import type { ClaimedQueueItem, DispatchOutcome } from '@fbuploadpro/contracts';
import { settleOutcome } from '../src/settlement.js';
import { runDispatchCycle, type DispatcherDbClient } from '../src/dispatcher.js';
import { MockFacebookPublishClient } from '../src/fb-client.js';

vi.mock('@fbuploadpro/contracts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@fbuploadpro/contracts')>();
  return {
    ...actual,
    decryptToken: vi.fn().mockResolvedValue('decrypted_token'),
  };
});

