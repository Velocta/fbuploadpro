import {
  DestinationEnqueueResponseSchema,
  ListDestinationPostingSlotsResponseSchema,
  type DestinationEnqueueIntent,
  type TikTokOptions,
  type YouTubePlatformOptions,
} from '@fbuploadpro/contracts';
import { api, buildTenantApiPath } from '@/lib/api';
import { DESTINATION_ENQUEUE_PATH } from '../composer/destination-enqueue';
import type { ComposerIntent } from '../composer/intent-selector';

/**
 * Client half of the unified destination enqueue for the non-Facebook
 * platform composers (spec 132 gated sets, on the spec 119/132
 * enabling backend: contracts PR 750, endpoint PR 756).
 *
 * The request shapes are spelled out field-for-field against the
 * contracts field types, exactly like the Facebook slice in
 * `composer/destination-enqueue.ts` (the contracts union is built
 * through a generic variant helper, so its inferred `platform` widens
 * to the whole Platform enum and the precise variants cannot be
 * extracted from it). The wire shape — validated server-side by
 * `DestinationEnqueueRequestSchema` — is exactly these.
 */

export interface YouTubeEnqueueRequest {
  platform: 'youtube';
  destinationId: string;
  kind: 'video';
  caption: string;
  title: string;
  mediaItemIds: string[];
  intent: DestinationEnqueueIntent;
  scheduledAt?: string;
  platformOptions: YouTubePlatformOptions;
}

export interface TikTokEnqueueRequest {
  platform: 'tiktok';
  destinationId: string;
  kind: 'video' | 'image';
  caption: string;
  mediaItemIds: string[];
  intent: DestinationEnqueueIntent;
  scheduledAt?: string;
  platformOptions?: TikTokOptions;
}

export type PlatformEnqueueRequest =
  YouTubeEnqueueRequest | TikTokEnqueueRequest;

/** Maps the composer family's intent vocabulary onto the enqueue contract's. */
export function toEnqueueIntent(
  intent: ComposerIntent,
): DestinationEnqueueIntent {
  return intent === 'schedule' ? 'scheduled' : intent;
}

/** Submits one unified enqueue and validates the created-item body. */
export async function submitPlatformEnqueue(
  subdomain: string,
  request: PlatformEnqueueRequest,
) {
  return api.post(
    buildTenantApiPath(subdomain, DESTINATION_ENQUEUE_PATH),
    request,
    {
      schema: DestinationEnqueueResponseSchema,
    },
  );
}

/** Reads the destination's unified posting slots + timezone (enabling backend, PR 756). */
export async function fetchDestinationPostingSlots(
  subdomain: string,
  destinationId: string,
  signal?: AbortSignal,
) {
  return api.get(
    buildTenantApiPath(
      subdomain,
      `/destinations/${destinationId}/posting-slots`,
    ),
    {
      schema: ListDestinationPostingSlotsResponseSchema,
      ...(signal ? { signal } : {}),
    },
  );
}
