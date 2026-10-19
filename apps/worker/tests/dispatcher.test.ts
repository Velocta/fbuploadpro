import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  encryptToken,
  type ClaimedQueueItem,
} from '@fbuploadpro/contracts';
import {
  claimDueItems,
  dispatchItem,
  runDispatchCycle,
  CLAIM_DUE_ITEMS_SQL,
  RECOVER_STUCK_ITEMS_SQL,
} from '../src/dispatcher.js';
import {
  MockFacebookPublishClient,
  FacebookGraphError,
} from '../src/fb-client.js';
import worker, { handleScheduled, type Env } from '../src/index.js';

