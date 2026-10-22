'use client';

/**
 * Point-of-need credentials gate (Spec 123, Part C — the PR #641 pattern,
 * generalised from the Facebook Accounts gate).
 *
 * Wraps a connect action for a BYOC platform (Instagram / Threads). The
 * gate blocks ONLY when the workspace's app details are known to be
 * missing: while the check is running, and when the check itself fails,
 * the connect action renders as normal (fail open — the Accounts-side
 * check in PR #641 behaves the same way, and the connect route re-checks
 * server-side anyway).
 */
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  THEME,
  RADII,
  SPACING,
  TYPOGRAPHY,
  COMPONENT_STYLES,
} from '@/lib/theme';

export type ByocGatePlatform = 'instagram' | 'threads';

export interface ByocGateStatus {
  isLoading: boolean;
  hasCredentials: boolean;
  error: string | null;
}

/**
 * Mirrors isConnectGatedByMissingCredentials from the Facebook Accounts
 * page: gated only when details are known to be missing — not while the
 * check runs, and not when the check failed.
 */
export function isByocGateBlocking(status: ByocGateStatus): boolean {
  return !status.isLoading && !status.hasCredentials && !status.error;
}

export const INSTAGRAM_SETUP_STEPS: string[] = [
  'Create a Meta app for your business.',
  'Add Instagram to the app and finish the Instagram sign-in setup.',
  'Copy the redirect address shown in Settings into your app.',
  'Paste your App ID and App Secret in Settings.',
];

export const THREADS_SETUP_STEPS: string[] = [
  'Open your Meta app and add the Threads use case.',
  'Find the Threads App ID and Threads App Secret — this pair is different from your main app pair, and using the main pair will not work.',
  'Paste the three addresses shown in Settings into the Threads settings.',
  'Save the Threads App ID and App Secret in Settings.',
];

export function defaultSetupSteps(platform: ByocGatePlatform): string[] {
  return platform === 'threads' ? THREADS_SETUP_STEPS : INSTAGRAM_SETUP_STEPS;
}

export interface ByocGatePromptProps {
  platform: ByocGatePlatform;
  platformName: string;
  subdomain: string;
  setupSteps?: string[];
}

export function ByocGatePrompt({
  platform,
  platformName,
  subdomain,
  setupSteps,
}: Readonly<ByocGatePromptProps>) {
  const steps = setupSteps ?? defaultSetupSteps(platform);
  const settingsHref = `/tenant/${subdomain}/settings?tab=${platform}`;
  return (
    <div
      data-testid="byoc-gate-prompt"
      style={{
        padding: `${SPACING.md} ${SPACING.lg}`,
        backgroundColor: 'rgba(250, 215, 52, 0.08)',
        border: '1px solid rgba(250, 215, 52, 0.25)',
        borderRadius: RADII.sm,
        color: `var(--text-main, ${THEME.default.text.primary})`,
        maxWidth: '560px',
        textAlign: 'left',
      }}
    >
      <p
        data-testid="byoc-gate-title"
        style={{
          margin: 0,
          fontSize: '0.9375rem',
          fontWeight: TYPOGRAPHY.weights.semibold,
        }}
      >
        Add your {platformName} app details first
      </p>
      <p
        style={{
          margin: `${SPACING.xs} 0 0 0`,
          fontSize: '0.875rem',
          lineHeight: 1.5,
          color: `var(--text-sub, ${THEME.default.text.secondary})`,
        }}
      >
        Before you can connect {platformName} accounts, your workspace needs
        its own {platformName} app details saved in Settings. It only takes a
        few minutes:
      </p>
      <ol
        data-testid="byoc-gate-steps"
        style={{
          margin: `${SPACING.sm} 0`,
          paddingLeft: SPACING.lg,
          fontSize: '0.875rem',
          lineHeight: 1.6,
          color: `var(--text-main, ${THEME.default.text.primary})`,
        }}
      >
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <Link
        href={settingsHref}
        data-testid="byoc-gate-settings-link"
        style={{
          ...COMPONENT_STYLES.secondaryButton(),
          textDecoration: 'none',
          fontSize: '0.8125rem',
          height: '32px',
          padding: `0 ${SPACING.md}`,
          display: 'inline-flex',
          alignItems: 'center',
          whiteSpace: 'nowrap',
          color: `var(--text-main, ${THEME.default.text.primary})`,
          border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
        }}
      >
        Add app details in Settings
      </Link>
    </div>
  );
}

export interface ByocGateProps {
  platform: ByocGatePlatform;
  platformName: string;
  subdomain: string;
  setupSteps?: string[];
  children: React.ReactNode;
  /** Test seam: skips the network check and renders from this status. */
  initialStatus?: ByocGateStatus;
}

export function ByocGate({
  platform,
  platformName,
  subdomain,
  setupSteps,
  children,
  initialStatus,
}: Readonly<ByocGateProps>) {
  const [status, setStatus] = useState<ByocGateStatus>(
    initialStatus ?? { isLoading: true, hasCredentials: false, error: null }
  );

  useEffect(() => {
    if (initialStatus || !subdomain) return;
    let isMounted = true;
    async function checkCredentials() {
      try {
        const res = await fetch(
          `/api/tenant/${subdomain}/settings/platform-credentials/${platform}`
        );
        if (!isMounted) return;
        if (res.ok) {
          const data = (await res.json()) as {
            hasSecret?: boolean;
            appId?: string | null;
          };
          setStatus({
            isLoading: false,
            hasCredentials: Boolean(data.appId && data.hasSecret),
            error: null,
          });
        } else {
          // Fail open: a failed check never blocks the connect action.
          setStatus({
            isLoading: false,
            hasCredentials: false,
            error: "Couldn't verify your app details just now.",
          });
        }
      } catch {
        if (!isMounted) return;
        setStatus({
          isLoading: false,
          hasCredentials: false,
          error: "Couldn't verify your app details just now.",
        });
      }
    }
    void checkCredentials();
    return () => {
      isMounted = false;
    };
  }, [initialStatus, subdomain, platform]);

  if (isByocGateBlocking(status)) {
    return (
      <ByocGatePrompt
        platform={platform}
        platformName={platformName}
        subdomain={subdomain}
        {...(setupSteps ? { setupSteps } : {})}
      />
    );
  }

  return <>{children}</>;
}
