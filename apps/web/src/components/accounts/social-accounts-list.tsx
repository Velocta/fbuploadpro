'use client';

/**
 * Unified Accounts list (Spec 123, Part C).
 *
 * Lists every connected social account in the workspace — all platforms
 * together, each labelled by platform — with its destinations. Clicking a
 * destination opens its dedicated section (spec 128 builds the section
 * internals; the routing lands there now). Renders nothing until there is
 * at least one social account, so the existing Facebook Accounts page is
 * unchanged for Facebook-only workspaces.
 */
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  THEME,
  SPACING,
  RADII,
  TYPOGRAPHY,
  COMPONENT_STYLES,
} from '@/lib/theme';
import { PLATFORM_LABELS, type Platform } from '@/lib/connect/registry';

export interface SocialDestinationItem {
  id: string;
  externalDestinationId: string;
  name: string;
  handle: string | null;
  avatarUrl: string | null;
  timezone: string;
  status: string;
}

export interface SocialAccountItem {
  id: string;
  platform: Platform;
  externalAccountId: string;
  displayName: string;
  avatarUrl: string | null;
  status: string;
  tokenExpiresAt: string | null;
  destinations: SocialDestinationItem[];
}

type StatusSignalType = 'operational' | 'queued' | 'critical' | 'idle';

export function socialStatusSignal(status: string): StatusSignalType {
  if (status === 'active') return 'operational';
  if (status === 'expired') return 'queued';
  if (status === 'revoked' || status === 'error') return 'critical';
  return 'idle';
}

export function socialStatusLabel(status: string): string {
  if (status === 'active') return 'Connected';
  if (status === 'expired') return 'Session expired — reconnect to keep posting';
  if (status === 'revoked') return 'Disconnected on the platform — reconnect to use it again';
  if (status === 'error') return 'Connection problem — reconnect to fix it';
  if (status === 'disconnected') return 'Disconnected';
  return status;
}

export interface SocialAccountsListProps {
  subdomain: string;
}

export function SocialAccountsList({
  subdomain,
}: Readonly<SocialAccountsListProps>) {
  const [accounts, setAccounts] = useState<SocialAccountItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!subdomain) return;
    let isMounted = true;
    async function load() {
      try {
        const res = await fetch(`/api/tenant/${subdomain}/accounts/social`);
        if (res.ok) {
          const data = (await res.json()) as {
            accounts?: SocialAccountItem[];
          };
          if (isMounted) {
            setAccounts(Array.isArray(data.accounts) ? data.accounts : []);
          }
        } else {
          console.warn(
            '[social-accounts-list] Failed to load connected accounts:',
            res.status
          );
        }
      } catch (err) {
        console.warn(
          '[social-accounts-list] Failed to load connected accounts:',
          err
        );
      } finally {
        if (isMounted) setIsLoaded(true);
      }
    }
    void load();
    return () => {
      isMounted = false;
    };
  }, [subdomain]);

  if (!isLoaded || accounts.length === 0) {
    return null;
  }

  return (
    <section
      data-testid="social-accounts-list"
      style={{ marginBottom: SPACING.xl }}
    >
      <h2
        style={{
          margin: `0 0 ${SPACING.xs} 0`,
          fontSize: '1.125rem',
          fontWeight: TYPOGRAPHY.weights.bold,
          color: `var(--text-main, ${THEME.default.text.primary})`,
        }}
      >
        Connected accounts
      </h2>
      <p
        style={{
          margin: `0 0 ${SPACING.md} 0`,
          fontSize: '0.875rem',
          color: `var(--text-sub, ${THEME.default.text.secondary})`,
        }}
      >
        Every account you have connected, across all platforms. Choose a
        destination to open it.
      </p>

      <div
        style={{
          backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
          border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          borderRadius: RADII.md,
        }}
      >
        {accounts.map((account, accountIndex) => (
          <div
            key={account.id}
            data-testid={`social-account-${account.id}`}
            style={{
              borderTop:
                accountIndex === 0
                  ? 'none'
                  : `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              padding: `${SPACING.md} ${SPACING.lg}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACING.sm,
                marginBottom: SPACING.sm,
              }}
            >
              <span
                style={COMPONENT_STYLES.statusDot(
                  socialStatusSignal(account.status)
                )}
              />
              <span
                style={{
                  fontSize: '0.9375rem',
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                }}
              >
                {account.displayName}
              </span>
              <span
                style={{
                  fontSize: '0.8125rem',
                  color: `var(--text-sub, ${THEME.default.text.secondary})`,
                }}
              >
                {PLATFORM_LABELS[account.platform] ?? account.platform} ·{' '}
                {socialStatusLabel(account.status)}
              </span>
            </div>

            {account.destinations.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  fontSize: '0.8125rem',
                  color: `var(--text-dim, ${THEME.default.text.muted})`,
                }}
              >
                No destinations added yet.
              </p>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {account.destinations.map((destination) => (
                  <Link
                    key={destination.id}
                    href={`/tenant/${subdomain}/destinations/${destination.id}`}
                    data-testid={`social-destination-${destination.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: SPACING.sm,
                      padding: `${SPACING.xs} 0`,
                      textDecoration: 'none',
                      color: `var(--text-main, ${THEME.default.text.primary})`,
                      fontSize: '0.875rem',
                    }}
                  >
                    <span style={{ fontWeight: TYPOGRAPHY.weights.medium }}>
                      {destination.name}
                    </span>
                    {destination.handle && (
                      <span
                        style={{
                          color: `var(--text-sub, ${THEME.default.text.secondary})`,
                          fontSize: '0.8125rem',
                        }}
                      >
                        {destination.handle.startsWith('@')
                          ? destination.handle
                          : `@${destination.handle}`}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
