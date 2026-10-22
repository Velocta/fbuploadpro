import React from 'react';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { getSessionSecret } from '@fbuploadpro/contracts';
import { THEME, SPACING, RADII, TYPOGRAPHY, PALETTE } from '@/lib/theme';
import { DestinationPicker } from '@/components/connect/destination-picker';
import {
  getPlatformConnectConfig,
  isKnownPlatform,
  PLATFORM_LABELS,
} from '@/lib/connect/registry';
import {
  verifyPendingDestinations,
  PENDING_COOKIE_NAME,
} from '@/lib/connect/state';
import {
  connectNoticeMessage,
  type ConnectNoticeCode,
} from '@/lib/connect/errors';

interface ConnectPickerPageProps {
  params: Promise<{ subdomain: string; platform: string }>;
  searchParams: Promise<{ notice?: string }>;
}

function resolveNoticeCode(
  notice: string | undefined,
  platform: string | null,
  hasPending: boolean
): ConnectNoticeCode | null {
  if (notice) return notice as ConnectNoticeCode;
  if (!platform) return 'connect_failed';
  if (!hasPending) return 'expired_link';
  return null;
}

function pickerHeading(
  noticeCode: ConnectNoticeCode | null,
  mode: 'picker' | 'single-confirm',
  platformName: string
): string {
  if (noticeCode) return `Connect ${platformName}`;
  if (mode === 'single-confirm') return `Add this ${platformName} destination`;
  return 'Choose what to add';
}

function pickerSubheading(
  noticeCode: ConnectNoticeCode | null,
  mode: 'picker' | 'single-confirm',
  platformName: string
): string {
  if (noticeCode) return connectNoticeMessage(noticeCode);
  if (mode === 'single-confirm') {
    return `Check this is the ${platformName} destination you want to post to, then add it.`;
  }
  return `Pick the ${platformName} destinations you want to post to. You can add more later.`;
}

/**
 * Post-connect destination picker page (Spec 123, Part C).
 *
 * The callback route stashes the discovered destinations in a signed
 * cookie; this page reads them back and renders the picker. Denials and
 * failures arrive here as a `notice` code and are shown in plain language.
 */
export default async function ConnectPickerPage({
  params,
  searchParams,
}: Readonly<ConnectPickerPageProps>) {
  const { subdomain, platform: platformParam } = await params;
  const { notice } = await searchParams;
  const platform = isKnownPlatform(platformParam) ? platformParam : null;
  const platformName = platform ? PLATFORM_LABELS[platform] : 'Platform';
  const accountsHref = `/tenant/${subdomain}/accounts`;

  let pending = null;
  if (platform && !notice) {
    const cookieStore = await cookies();
    const pendingCookie = cookieStore.get(PENDING_COOKIE_NAME)?.value;
    if (pendingCookie) {
      try {
        const parsed = await verifyPendingDestinations(
          pendingCookie,
          getSessionSecret()
        );
        if (
          parsed.platform === platform &&
          parsed.tenantSubdomain === subdomain
        ) {
          pending = parsed;
        }
      } catch (err) {
        console.error('[connect/picker] Pending cookie invalid:', err);
      }
    }
  }

  const noticeCode = resolveNoticeCode(notice, platform, Boolean(pending));

  const mode =
    (platform
      ? getPlatformConnectConfig(platform)?.destinationMode
      : undefined) ?? 'picker';

  return (
    <div
      data-testid="connect-picker-page"
      style={{
        width: '100%',
        maxWidth: '720px',
        margin: '0 auto',
        padding: SPACING.xl,
        boxSizing: 'border-box',
      }}
    >
      <h1
        style={{
          margin: `0 0 ${SPACING.xs} 0`,
          fontSize: '1.5rem',
          fontWeight: TYPOGRAPHY.weights.bold,
          letterSpacing: TYPOGRAPHY.tracking.h1,
          color: `var(--text-main, ${THEME.default.text.primary})`,
        }}
      >
        {pickerHeading(noticeCode, mode, platformName)}
      </h1>
      <p
        style={{
          margin: `0 0 ${SPACING.lg} 0`,
          fontSize: '0.875rem',
          color: `var(--text-sub, ${THEME.default.text.secondary})`,
          lineHeight: 1.5,
        }}
      >
        {pickerSubheading(noticeCode, mode, platformName)}
      </p>

      {noticeCode || !pending || !platform ? (
        <div
          data-testid="connect-picker-notice"
          style={{
            padding: `${SPACING.md} ${SPACING.lg}`,
            backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
            border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            borderRadius: RADII.md,
          }}
        >
          <Link
            href={accountsHref}
            data-testid="connect-picker-accounts-link"
            style={{
              color: PALETTE.primary,
              fontWeight: TYPOGRAPHY.weights.semibold,
              fontSize: '0.875rem',
              textDecoration: 'underline',
            }}
          >
            Go to Accounts
          </Link>
        </div>
      ) : (
        <DestinationPicker
          platform={platform}
          subdomain={subdomain}
          destinations={pending.destinations}
          mode={mode}
        />
      )}
    </div>
  );
}
