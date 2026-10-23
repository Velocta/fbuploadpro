import type { PostFormat } from '@fbuploadpro/contracts';
import { api, buildTenantApiPath } from '@/lib/api';
import {
  BulkEnqueueResponseSchema,
  type BulkEnqueueResponse,
} from '@/lib/api/schemas/queue';

export interface BulkSubmitItem {
  mediaId: string;
  format: PostFormat;
  caption: string;
  scheduledTime: string;
}

export interface BulkCreateInput {
  pageId: string;
  subdomain: string;
  items: BulkSubmitItem[];
}

/**
 * Bulk-create submit plumbing on the typed API client (spec 137 §3.1,
 * spec 132 C2.5). Mirrors `composer/composer-submit.ts`: a failed request
 * throws an `ApiError` carrying the server's plain-language message —
 * never a silent return — and the caller turns an HTTP failure into
 * per-row results (spec §5.15) and any other failure into the submit
 * error line.
 */
export async function submitBulkCreate(input: BulkCreateInput): Promise<BulkEnqueueResponse> {
  const { pageId, subdomain, items } = input;
  return api.post(buildTenantApiPath(subdomain, '/publishing/queue/bulk'), { pageId, items }, {
    schema: BulkEnqueueResponseSchema,
  });
}
