import { resolvePublishLimit } from '@fbuploadpro/contracts';

/**
 * D5 limit indicator for the destination composers (spec 132 §6,
 * OD132-3 DECIDED (a): existing data only).
 *
 * The numbers come from the contracts publish-limit config at runtime —
 * the same config the claim pipeline enforces and the contracts parity
 * test pins against the database seed — so the indicator can never
 * drift from enforcement and no limit number is written in composer
 * code. There is no web-readable per-destination USAGE feed today, so
 * the indicator states the cap the destination publishes under; it
 * never invents a "posts remaining" figure (the OD132-3 stop rule —
 * the Facebook indicator works the same way: state that exists, or
 * nothing).
 */

type LimitedPlatform = 'instagram' | 'threads';

const PLATFORM_NAMES: Record<LimitedPlatform, string> = {
  instagram: 'Instagram',
  threads: 'Threads',
};

/**
 * Plain-language window label — "900" -> "15 minutes"; "3600" -> "1
 * hour"; "86400" -> "24 hours". The one implementation every
 * destination composer's limit indicator renders through (the X set's
 * structured indicator included), so window wording can never drift
 * between platforms.
 */
export function formatLimitWindowLabel(windowSeconds: number): string {
  if (windowSeconds % 86_400 === 0) {
    const days = windowSeconds / 86_400;
    return days === 1 ? '24 hours' : `${days} days`;
  }
  if (windowSeconds % 3_600 === 0) {
    const hours = windowSeconds / 3_600;
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
  if (windowSeconds % 60 === 0) {
    const minutes = windowSeconds / 60;
    return minutes === 1 ? '1 minute' : `${minutes} minutes`;
  }
  return `${windowSeconds} seconds`;
}

/**
 * The plain-language limit line for a platform's composer, derived
 * entirely from `resolvePublishLimit` — or null when the platform
 * carries no centred cap to state.
 */
export function getDestinationLimitNote(platform: LimitedPlatform): string | null {
  const limit = resolvePublishLimit(platform);
  if (!limit) return null;
  const name = PLATFORM_NAMES[platform];
  const parts: string[] = [];
  if (limit.publishedPosts) {
    parts.push(
      `up to ${limit.publishedPosts.maxCount} posts in ${formatLimitWindowLabel(limit.publishedPosts.windowSeconds)}`
    );
  }
  if (limit.publishCalls) {
    parts.push(
      `up to ${limit.publishCalls.maxCount} publishing actions in ${formatLimitWindowLabel(limit.publishCalls.windowSeconds)}`
    );
  }
  if (parts.length === 0) return null;
  return `${name} lets each account publish ${parts.join(' and ')}. If a limit is reached, queued posts wait and go out as room frees up.`;
}
