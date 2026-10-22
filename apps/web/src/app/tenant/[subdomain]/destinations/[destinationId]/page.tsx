'use client';

/**
 * Dedicated-section landing for a destination (Spec 123, Part C).
 *
 * Routing contract (recorded in the spec 123 Part C PR for spec 128):
 *   /tenant/[subdomain]/destinations/[destinationId]
 * loads the destination + its owning account from
 *   GET /api/tenant/[subdomain]/accounts/social/[destinationId]
 * and renders the destination's real data. The section internals — queue,
 * composer, posting times, history — are built by spec 128 on this page.
 */
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  THEME,
  SPACING,
  RADII,
  TYPOGRAPHY,
  PALETTE,
  COMPONENT_STYLES,
} from '@/lib/theme';
import { PLATFORM_LABELS, type Platform } from '@/lib/connect/registry';
import {
  socialStatusLabel,
  socialStatusSignal,
} from '@/components/accounts/social-accounts-list';

interface DestinationDetail {
  id: string;
  externalDestinationId: string;
  name: string;
  handle: string | null;
  avatarUrl: string | null;
  timezone: string;
  status: string;
  platform: Platform;
  account: {
    id: string;
    displayName: string;
    platform: Platform;
    status: string;
  };
}

export default function DestinationSectionPage() {
  const params = useParams();
  const subdomain = (params?.subdomain as string) || '';
  const destinationId = (params?.destinationId as string) || '';

  const [destination, setDestination] = useState<DestinationDetail | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!subdomain || !destinationId) return;
    let isMounted = true;
    async function load() {
      try {
        const res = await fetch(
          `/api/tenant/${subdomain}/accounts/social/${destinationId}`
        );
        if (!isMounted) return;
        if (res.ok) {
          const data = (await res.json()) as {
            destination?: DestinationDetail;
          };
          setDestination(data.destination ?? null);
          if (!data.destination) {
            setLoadError("We couldn't find this destination.");
          }
        } else if (res.status === 404) {
          setLoadError("We couldn't find this destination.");
        } else {
          setLoadError("Couldn't load this destination. Please try again.");
        }
      } catch {
        if (isMounted) {
          setLoadError("Couldn't load this destination. Please try again.");
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    void load();
    return () => {
      isMounted = false;
    };
  }, [subdomain, destinationId]);

  const accountsHref = `/tenant/${subdomain}/accounts`;

  return (
    <div
      data-testid="destination-section-page"
      style={{
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: SPACING.xl,
        boxSizing: 'border-box',
      }}
    >
      <Link
        href={accountsHref}
        style={{
          fontSize: '0.8125rem',
          color: PALETTE.primary,
          fontWeight: TYPOGRAPHY.weights.semibold,
          textDecoration: 'underline',
        }}
      >
        Back to Accounts
      </Link>

      {isLoading && (
        <p
          style={{
            marginTop: SPACING.lg,
            fontSize: '0.875rem',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
          }}
        >
          Loading…
        </p>
      )}

      {!isLoading && loadError && (
        <p
          data-testid="destination-load-error"
          style={{
            marginTop: SPACING.lg,
            fontSize: '0.875rem',
            color: PALETTE.accent3,
          }}
        >
          {loadError}
        </p>
      )}

      {!isLoading && destination && (
        <div style={{ marginTop: SPACING.lg }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: SPACING.md,
              flexWrap: 'wrap',
            }}
          >
            <h1
              data-testid="destination-name"
              style={{
                margin: 0,
                fontSize: '1.5rem',
                fontWeight: TYPOGRAPHY.weights.bold,
                letterSpacing: TYPOGRAPHY.tracking.h1,
                color: `var(--text-main, ${THEME.default.text.primary})`,
              }}
            >
              {destination.name}
            </h1>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: SPACING.xs,
                fontSize: '0.8125rem',
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
              }}
            >
              <span
                style={COMPONENT_STYLES.statusDot(
                  socialStatusSignal(destination.status)
                )}
              />
              {socialStatusLabel(destination.status)}
            </span>
          </div>

          <div
            style={{
              marginTop: SPACING.md,
              backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              borderRadius: RADII.md,
              padding: `${SPACING.md} ${SPACING.lg}`,
              display: 'flex',
              flexDirection: 'column',
              gap: SPACING.xs,
              fontSize: '0.875rem',
              color: `var(--text-main, ${THEME.default.text.primary})`,
            }}
          >
            <p style={{ margin: 0 }}>
              Platform:{' '}
              {PLATFORM_LABELS[destination.platform] ?? destination.platform}
            </p>
            <p style={{ margin: 0 }}>
              Connected through: {destination.account.displayName}
            </p>
            {destination.handle && (
              <p style={{ margin: 0 }}>
                Handle:{' '}
                {destination.handle.startsWith('@')
                  ? destination.handle
                  : `@${destination.handle}`}
              </p>
            )}
            <p style={{ margin: 0 }}>Posting timezone: {destination.timezone}</p>
          </div>
        </div>
      )}
    </div>
  );
}
