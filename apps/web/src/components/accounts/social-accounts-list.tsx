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
 *
 * Spec 131 PR-131-1: presentation rebuilt on the design system —
 * token-backed utilities only (zero inline styles) and status as
 * colour + icon + text via the shared/ui `StatusDot` (spec §6.4.1 /
 * OD-3). The exported helpers (`socialStatusSignal`,
 * `socialStatusLabel`, `loadSocialAccounts`) keep their names and
 * behaviour — the destinations route and the connect suites consume
 * them.
 */
import React, { useEffect, useState } from 'react';
import Link from 'next/link';

import { StatusDot } from '@/components/shared/ui/status-dot';
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

export interface SocialAccountsListViewProps {
  subdomain: string;
  accounts: SocialAccountItem[];
}

function SocialDestinationLink({
  subdomain,
  destination,
}: Readonly<{
  subdomain: string;
  destination: SocialDestinationItem;
}>) {
  return (
    <Link
      href={`/tenant/${subdomain}/destinations/${destination.id}`}
      data-testid={`social-destination-${destination.id}`}
      className="flex min-h-11 items-center gap-2 py-1 text-body text-ink outline-none hover:underline focus-visible:outline-2 focus-visible:outline-brand-gold"
    >
      <span className="font-medium">{destination.name}</span>
      {destination.handle && (
        <span className="text-body text-ink-sub">
          {destination.handle.startsWith('@')
            ? destination.handle
            : `@${destination.handle}`}
        </span>
      )}
    </Link>
  );
}

function SocialAccountBlock({
  subdomain,
  account,
  isFirst,
}: Readonly<{
  subdomain: string;
  account: SocialAccountItem;
  isFirst: boolean;
}>) {
  return (
    <div
      data-testid={`social-account-${account.id}`}
      className={isFirst ? 'px-6 py-4' : 'border-t border-line px-6 py-4'}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <StatusDot
          status={socialStatusSignal(account.status)}
          label={socialStatusLabel(account.status)}
        />
        <span className="text-body font-semibold text-ink">{account.displayName}</span>
        <span className="text-body text-ink-sub">
          {PLATFORM_LABELS[account.platform] ?? account.platform}
        </span>
      </div>

      {account.destinations.length === 0 ? (
        <p className="m-0 text-body text-ink-dim">No destinations added yet.</p>
      ) : (
        <div className="flex flex-col">
          {account.destinations.map((destination) => (
            <SocialDestinationLink
              key={destination.id}
              subdomain={subdomain}
              destination={destination}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function SocialAccountsListView({
  subdomain,
  accounts,
}: Readonly<SocialAccountsListViewProps>) {
  return (
    <section data-testid="social-accounts-list" className="mb-6">
      <h2 className="mb-1 text-lg font-bold text-ink">Connected accounts</h2>
      <p className="mb-4 text-body text-ink-sub">
        Every account you have connected, across all platforms. Choose a
        destination to open it.
      </p>

      <div className="rounded-md border border-line bg-panel">
        {accounts.map((account, accountIndex) => (
          <SocialAccountBlock
            key={account.id}
            subdomain={subdomain}
            account={account}
            isFirst={accountIndex === 0}
          />
        ))}
      </div>
    </section>
  );
}

/** Loads the unified accounts list; returns null when the load fails. */
export async function loadSocialAccounts(
  subdomain: string,
  fetcher: typeof fetch = fetch
): Promise<SocialAccountItem[] | null> {
  try {
    const res = await fetcher(`/api/tenant/${subdomain}/accounts/social`);
    if (!res.ok) {
      console.warn(
        '[social-accounts-list] Failed to load connected accounts:',
        res.status
      );
      return null;
    }
    const data = (await res.json()) as { accounts?: SocialAccountItem[] };
    return Array.isArray(data.accounts) ? data.accounts : [];
  } catch (err) {
    console.warn(
      '[social-accounts-list] Failed to load connected accounts:',
      err
    );
    return null;
  }
}

export function SocialAccountsList({
  subdomain,
}: Readonly<SocialAccountsListProps>) {
  const [accounts, setAccounts] = useState<SocialAccountItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!subdomain) return;
    let isMounted = true;
    void loadSocialAccounts(subdomain).then((loaded) => {
      if (!isMounted) return;
      if (loaded) setAccounts(loaded);
      setIsLoaded(true);
    });
    return () => {
      isMounted = false;
    };
  }, [subdomain]);

  if (!isLoaded || accounts.length === 0) {
    return null;
  }

  return <SocialAccountsListView subdomain={subdomain} accounts={accounts} />;
}
