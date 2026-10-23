'use client';

/**
 * Platform connect-info view — YouTube / X / TikTok tabs
 * (spec 135 PR-135-4, spec §5.5 / §8 close-out).
 *
 * Explanation-only tab for a platform with nothing to set up here:
 * it explains, in plain language, how connecting works and sends
 * the user to Accounts, where the Connect action lives (spec 123
 * D1/D3/D4). It never renders a form, an input, or a paste field —
 * none exists on these tabs and none is added.
 *
 * Rebuilt clean-room on the spec 129 design system (tokens +
 * shared/ui primitives): the legacy inline styles and the
 * `lib/theme` / `COMPONENT_STYLES` imports are deleted — this was
 * the last `lib/theme` consumer in the settings subtree. The card,
 * heading, and prose geometry follow the rebuilt credential tabs'
 * pattern (hairline-bordered panel, token type scale); the copy is
 * §5.5 verbatim, carried by the per-platform config views
 * (`x-settings-view.tsx` etc.) — the X tab's strings are preserved
 * byte-identical per OD-135-3 (a).
 */

import React from 'react';

import { Button } from '@/components/shared/ui/button';

export interface PlatformConnectInfoConfig {
  /** Platform slug, e.g. "youtube". */
  platform: string;
  /** Platform name shown to the user, e.g. "YouTube". */
  displayName: string;
  /** Prefix for data-testid values, e.g. "youtube". */
  testIdPrefix: string;
  /** Plain-language paragraphs explaining how connecting works. */
  paragraphs: readonly string[];
}

export interface PlatformConnectInfoViewProps {
  subdomain: string;
  config: PlatformConnectInfoConfig;
}

export function PlatformConnectInfoView({
  subdomain,
  config,
}: Readonly<PlatformConnectInfoViewProps>) {
  const { displayName, testIdPrefix, paragraphs } = config;
  const accountsHref = `/tenant/${subdomain}/accounts`;
  const headingId = `${testIdPrefix}-connect-info-heading`;

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <section
        data-testid={`${testIdPrefix}-connect-info-card`}
        aria-labelledby={headingId}
        className="flex flex-col gap-6 rounded-md border border-line bg-panel p-6 shadow-card"
      >
        <div>
          <h2 id={headingId} className="text-lg font-semibold text-ink">
            {`Connect ${displayName}`}
          </h2>
          {paragraphs.map((paragraph) => (
            <p key={paragraph} className="mt-2 text-body text-ink-sub">
              {paragraph}
            </p>
          ))}
        </div>

        <div>
          <Button asChild variant="secondary">
            <a href={accountsHref} data-testid={`${testIdPrefix}-accounts-link`}>
              Go to Accounts
            </a>
          </Button>
        </div>
      </section>
    </div>
  );
}
