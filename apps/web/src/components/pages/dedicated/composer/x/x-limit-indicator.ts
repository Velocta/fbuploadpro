/**
 * The X composer's posting-limit indicator (spec 132 §4.5, §6 D5 row;
 * spec 128 §5.17).
 *
 * Single source of truth: the numbers come from the contracts limits
 * config (`resolvePublishLimitWindow('x', 'publishedPosts')`) at runtime
 * — never a literal in this subtree, never a fetched usage count. No
 * client-facing endpoint exposes how many posts this destination has
 * already published in the current window (OD132-3(a): indicators come
 * from existing data only), so the indicator states the account's limit
 * and the defer behaviour (caps defer, never fail — spec 119 D5) instead
 * of inventing a usage bar.
 */
import { resolvePublishLimitWindow } from '@fbuploadpro/contracts';
import { formatLimitWindowLabel } from '../destination/destination-limit';

export interface XLimitIndicator {
  /** Posts allowed per window, from the contracts config. */
  maxCount: number;
  /** Window length in seconds, from the contracts config. */
  windowSeconds: number;
  /** Plain-language window, e.g. "15 minutes". */
  windowLabel: string;
  /** The line the composer renders. */
  message: string;
}

export function getXLimitIndicator(): XLimitIndicator | null {
  const limit = resolvePublishLimitWindow('x', 'publishedPosts');
  if (!limit) {
    return null;
  }
  const windowLabel = formatLimitWindowLabel(limit.windowSeconds);
  return {
    maxCount: limit.maxCount,
    windowSeconds: limit.windowSeconds,
    windowLabel,
    message:
      `This account's limit on X is ${limit.maxCount} posts per ${windowLabel}. ` +
      'Posts past the limit go out when the window opens again — they never fail.',
  };
}
