'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY, COMPONENT_STYLES } from '@/lib/theme';

export interface AccountStateRecord {
  status?: string | undefined;
  updatedAt?: string | undefined;
}

export interface AccountSnapshot {
  id: string;
  fbAccountId?: string | undefined;
  displayName?: string | undefined;
  status?: string | undefined;
  updatedAt?: string | undefined;
}

export interface ConnectAccountModalProps {
  subdomain: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountConnected: () => void;
  onConnectionNotice?: (notice: { type: 'success' | 'error'; message: string }) => void;
  existingAccountIds?: string[];
  reconnectingAccount?: {
    id: string;
    fbAccountId?: string | undefined;
    displayName: string;
    status?: string | undefined;
    updatedAt?: string | undefined;
  } | null;
  initialAccounts?: AccountSnapshot[];
}

export type PollOutcome =
  | { matched: false }
  | { matched: true; kind: 'connected'; accountName?: string | undefined }
  | { matched: true; kind: 'already_connected'; accountName: string }
  | {
      matched: true;
      kind: 'reconnected_mismatch';
      newAccountName: string;
      expectedAccountName: string;
    };

function formatTimer(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function isAccountUpdatedInSnapshot(
  acc: AccountSnapshot,
  initialIds: Set<string>,
  initialStates: Map<string, AccountStateRecord>
): boolean {
  if (!initialIds.has(acc.id)) {
    return true;
  }
  const prevState = initialStates.get(acc.id);
  if (!prevState) {
    return false;
  }
  if (prevState.status === 'expired' && acc.status === 'active') {
    return true;
  }
  return Boolean(acc.updatedAt && prevState.updatedAt && acc.updatedAt !== prevState.updatedAt);
}

function isTargetReconnected(
  acc: AccountSnapshot,
  reconnectingAccount: NonNullable<ConnectAccountModalProps['reconnectingAccount']>,
  initialStates: Map<string, AccountStateRecord>
): boolean {
  const isMatchingId =
    acc.id === reconnectingAccount.id ||
    Boolean(reconnectingAccount.fbAccountId && acc.fbAccountId === reconnectingAccount.fbAccountId);
  if (!isMatchingId) {
    return false;
  }
  const prevState = initialStates.get(acc.id);
  const prevStatus = prevState?.status ?? reconnectingAccount.status ?? 'expired';
  if (prevStatus === 'expired' && acc.status === 'active') {
    return true;
  }
  const prevUpdatedAt = prevState?.updatedAt ?? reconnectingAccount.updatedAt;
  return Boolean(acc.updatedAt && prevUpdatedAt && acc.updatedAt !== prevUpdatedAt);
}

export function evaluateAccountConnectionPoll(
  accounts: AccountSnapshot[],
  initialIds: Set<string>,
  initialStates: Map<string, AccountStateRecord>,
  reconnectingAccount?: ConnectAccountModalProps['reconnectingAccount']
): PollOutcome {
  if (reconnectingAccount) {
    const targetAcc = accounts.find((acc) =>
      isTargetReconnected(acc, reconnectingAccount, initialStates)
    );
    if (targetAcc) {
      return { matched: true, kind: 'connected', accountName: targetAcc.displayName };
    }
    const differentAcc = accounts.find(
      (acc) =>
        acc.id !== reconnectingAccount.id &&
        isAccountUpdatedInSnapshot(acc, initialIds, initialStates)
    );
    if (differentAcc) {
      return {
        matched: true,
        kind: 'reconnected_mismatch',
        newAccountName: differentAcc.displayName || 'another account',
        expectedAccountName: reconnectingAccount.displayName,
      };
    }
    return { matched: false };
  }

  const newAcc = accounts.find((acc) => !initialIds.has(acc.id));
  if (newAcc) {
    return { matched: true, kind: 'connected', accountName: newAcc.displayName };
  }

  const refreshedAcc = accounts.find((acc) =>
    isAccountUpdatedInSnapshot(acc, initialIds, initialStates)
  );
  if (refreshedAcc) {
    return {
      matched: true,
      kind: 'already_connected',
      accountName: refreshedAcc.displayName || 'Account',
    };
  }

  return { matched: false };
}
export function buildDirectConnectUrl(
  reconnectingAccount?: ConnectAccountModalProps['reconnectingAccount']
): string {
  if (!reconnectingAccount) {
    return '/api/auth/facebook';
  }
  const params = new URLSearchParams();
  if (reconnectingAccount.fbAccountId) {
    params.set('expectedFbAccountId', reconnectingAccount.fbAccountId);
  }
  params.set('expectedDisplayName', reconnectingAccount.displayName);
  return `/api/auth/facebook?${params.toString()}`;
}

interface ConnectOptionButtonProps {
  testId: string;
  disabled: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  actionHint?: string | undefined;
}

function ConnectOptionButton({
  testId,
  disabled,
  onClick,
  icon,
  title,
  description,
  actionHint,
}: Readonly<ConnectOptionButtonProps>) {
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACING.md,
        padding: `${SPACING.md} ${SPACING.lg}`,
        backgroundColor: 'transparent',
        border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
        borderRadius: RADII.md,
        cursor: disabled ? 'not-allowed' : 'pointer',
        textAlign: 'left',
        transition: 'border-color 0.15s ease, background-color 0.15s ease',
        width: '100%',
        boxSizing: 'border-box',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = `var(--bg-subtle, ${THEME.default.surfaces.subtle})`;
          e.currentTarget.style.borderColor = PALETTE.primary;
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.borderColor = `var(--border-subtle, ${THEME.default.borders.hairline})`;
        }
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: PALETTE.primary,
        }}
      >
        {icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: TYPOGRAPHY.weights.semibold,
            fontSize: '0.9375rem',
            color: `var(--text-main, ${THEME.default.text.primary})`,
            marginBottom: '2px',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: '0.8125rem',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
            lineHeight: 1.4,
          }}
        >
          {description}
        </div>
        {actionHint && (
          <div
            style={{
              fontSize: '0.75rem',
              color: `var(--text-dim, ${THEME.default.text.muted})`,
              marginTop: '4px',
            }}
          >
            {actionHint}
          </div>
        )}
      </div>

      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{
          color: `var(--text-dim, ${THEME.default.text.muted})`,
          flexShrink: 0,
        }}
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}

interface MagicLinkViewProps {
  magicUrl: string | null;
  remainingSeconds: number;
  copySuccess: boolean;
  isGeneratingMagic: boolean;
  onCopyLink: () => void;
  onRegenerateLink: () => void;
}

export function MagicLinkView({
  magicUrl,
  remainingSeconds,
  copySuccess,
  isGeneratingMagic,
  onCopyLink,
  onRegenerateLink,
}: Readonly<MagicLinkViewProps>) {
  const isExpired = remainingSeconds <= 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
      <p style={{ margin: 0, fontSize: '0.8125rem', color: `var(--text-sub, ${THEME.default.text.secondary})`, lineHeight: 1.5 }}>
        Open this link in the browser or mobile window where your Facebook account is currently logged in. Once you approve access there, this window will update automatically.
      </p>

      {isExpired ? (
        <button
          type="button"
          data-testid="magic-regenerate-button"
          disabled={isGeneratingMagic}
          onClick={onRegenerateLink}
          style={{
            ...COMPONENT_STYLES.primaryButton,
            width: '100%',
            fontSize: '0.8125rem',
            fontWeight: TYPOGRAPHY.weights.semibold,
            cursor: isGeneratingMagic ? 'not-allowed' : 'pointer',
          }}
        >
          {isGeneratingMagic ? 'Generating Magic Link...' : 'Link expired — Generate a new link'}
        </button>
      ) : (
        <div style={{ display: 'flex', gap: SPACING.xs, alignItems: 'center' }}>
          <input
            type="text"
            readOnly
            data-testid="magic-url-input"
            value={magicUrl ?? ''}
            onClick={onCopyLink}
            style={{
              flex: 1,
              height: '38px',
              padding: `0 ${SPACING.sm}`,
              backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              borderRadius: RADII.sm,
              fontSize: '0.8125rem',
              color: `var(--text-main, ${THEME.default.text.primary})`,
              outline: 'none',
              fontFamily: TYPOGRAPHY.mono,
              cursor: 'pointer',
            }}
          />

          <button
            type="button"
            data-testid="magic-copy-button"
            onClick={onCopyLink}
            style={{
              height: '38px',
              padding: `0 ${SPACING.md}`,
              backgroundColor: copySuccess ? PALETTE.accent4 : PALETTE.primary,
              color: PALETTE.background,
              border: 'none',
              borderRadius: RADII.sm,
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: SPACING.xs,
              whiteSpace: 'nowrap',
              transition: 'background-color 0.15s ease',
            }}
          >
            {copySuccess ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      )}

      {/* Countdown & Status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
          borderRadius: RADII.sm,
          fontSize: '0.75rem',
          color: `var(--text-dim, ${THEME.default.text.muted})`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            data-testid="magic-pulse-indicator"
            style={{
              width: '6px',
              height: '6px',
              borderRadius: RADII.full,
              backgroundColor: isExpired ? PALETTE.accent3 : PALETTE.primary,
              display: 'inline-block',
            }}
          />
          <span>{isExpired ? 'Magic link expired' : 'Waiting for Facebook approval...'}</span>
        </div>

        <span data-testid="magic-countdown" style={{ fontWeight: TYPOGRAPHY.weights.medium }}>
          {isExpired ? 'Link expired' : `Link expires in ${formatTimer(remainingSeconds)}`}
        </span>
      </div>
    </div>
  );
}

interface ConnectionResultViewProps {
  completionNotice: {
    kind: 'connected' | 'already_connected' | 'reconnected_mismatch';
    message: string;
  } | null;
}

export function ConnectionResultView({
  completionNotice,
}: Readonly<ConnectionResultViewProps>) {
  const isMismatch = completionNotice?.kind === 'reconnected_mismatch';
  const heading = isMismatch ? 'Different account connected' : 'Account connected';
  const subtext =
    completionNotice?.message ?? 'your facebook account is successfully connected';

  return (
    <div
      data-testid="magic-success-animation"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 0',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: RADII.full,
          backgroundColor: isMismatch
            ? 'rgba(246, 70, 93, 0.15)'
            : 'rgba(46, 189, 133, 0.15)',
          border: `1px solid ${
            isMismatch ? 'rgba(246, 70, 93, 0.35)' : 'rgba(46, 189, 133, 0.35)'
          }`,
          color: isMismatch ? PALETTE.accent3 : PALETTE.accent4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: SPACING.sm,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div style={{ fontWeight: TYPOGRAPHY.weights.semibold, fontSize: '1rem', color: `var(--text-main, ${THEME.default.text.primary})` }}>
        {heading}
      </div>
      <div
        data-testid={isMismatch ? 'magic-mismatch-notice' : 'magic-success-message'}
        style={{ fontSize: '0.8125rem', color: `var(--text-sub, ${THEME.default.text.secondary})`, marginTop: '4px' }}
      >
        {subtext}
      </div>
    </div>
  );
}

const EMPTY_IDS: string[] = [];
const EMPTY_ACCOUNTS: AccountSnapshot[] = [];

export function ConnectAccountModal({
  subdomain,
  open,
  onOpenChange,
  onAccountConnected,
  onConnectionNotice,
  existingAccountIds = EMPTY_IDS,
  reconnectingAccount = null,
  initialAccounts = EMPTY_ACCOUNTS,
}: Readonly<ConnectAccountModalProps>) {
  const [view, setView] = useState<'choose' | 'magic' | 'success'>('choose');
  const [isDirectConnecting, setIsDirectConnecting] = useState(false);
  const [magicUrl, setMagicUrl] = useState<string | null>(null);
  const [isGeneratingMagic, setIsGeneratingMagic] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(900); // 15 minutes
  const [magicError, setMagicError] = useState<string | null>(null);
  const [completionNotice, setCompletionNotice] = useState<{
    kind: 'connected' | 'already_connected' | 'reconnected_mismatch';
    message: string;
  } | null>(null);

  const wasOpenRef = useRef(false);
  const initialAccountIdsRef = useRef<Set<string>>(new Set(existingAccountIds));
  const initialAccountStatesRef = useRef<Map<string, AccountStateRecord>>(
    new Map()
  );

  // Reset state when modal transitions to open
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setView('choose');
      setIsDirectConnecting(false);
      setMagicUrl(null);
      setCopySuccess(false);
      setRemainingSeconds(900);
      setMagicError(null);
      setCompletionNotice(null);

      const ids = new Set<string>(existingAccountIds);
      const stateMap = new Map<string, AccountStateRecord>();
      for (const acc of initialAccounts) {
        ids.add(acc.id);
        stateMap.set(acc.id, { status: acc.status, updatedAt: acc.updatedAt });
      }
      if (reconnectingAccount) {
        ids.add(reconnectingAccount.id);
        stateMap.set(reconnectingAccount.id, {
          status: reconnectingAccount.status ?? 'expired',
          updatedAt: reconnectingAccount.updatedAt,
        });
      }
      initialAccountIdsRef.current = ids;
      initialAccountStatesRef.current = stateMap;
    }
    wasOpenRef.current = open;
  }, [open, existingAccountIds, initialAccounts, reconnectingAccount]);

  // Handle Direct Connection redirect
  const handleDirectConnect = () => {
    setIsDirectConnecting(true);
    window.location.href = buildDirectConnectUrl(reconnectingAccount);
  };

  // Generate Magic Link
  const handleStartMagicLink = async () => {
    setIsGeneratingMagic(true);
    setMagicError(null);
    try {
      const requestInit: RequestInit = reconnectingAccount
        ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              expectedFbAccountId: reconnectingAccount.fbAccountId,
              expectedDisplayName: reconnectingAccount.displayName,
            }),
          }
        : { method: 'POST' };
      const res = await fetch(`/api/tenant/${subdomain}/accounts/magic-link`, requestInit);
      if (!res.ok) {
        throw new Error("Couldn't generate the connection link. Please try again.");
      }
      const data = await res.json();
      setMagicUrl(data.magicUrl);
      setRemainingSeconds(data.expiresInSeconds ?? 900);
      setView('magic');
    } catch (_err) {
      // Ignored because generation error is handled via user-facing error state
      setMagicError("Couldn't generate the magic link. Please try again.");
    } finally {
      setIsGeneratingMagic(false);
    }
  };

  // Copy to clipboard
  const handleCopyLink = async () => {
    if (!magicUrl) return;
    try {
      await navigator.clipboard.writeText(magicUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (_err) {
      // Ignored because clipboard write failure falls back to manual link selection
      setCopySuccess(false);
    }
  };

  const isLinkExpired = remainingSeconds <= 0;

  // Live countdown timer for Magic Link
  useEffect(() => {
    if (view !== 'magic' || !open || isLinkExpired) return;
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [view, open, isLinkExpired]);

  // Check for newly connected or reconnected account
  const pollAccounts = useCallback(async () => {
    try {
      const res = await fetch(`/api/tenant/${subdomain}/accounts`);
      if (!res.ok) return;
      const data = await res.json();
      const accounts: AccountSnapshot[] = data.accounts || [];

      const outcome = evaluateAccountConnectionPoll(
        accounts,
        initialAccountIdsRef.current,
        initialAccountStatesRef.current,
        reconnectingAccount
      );

      if (outcome.matched) {
        if (outcome.kind === 'reconnected_mismatch') {
          const message = `You signed into ${outcome.newAccountName} instead of ${outcome.expectedAccountName}. ${outcome.expectedAccountName} still needs to be reconnected.`;
          setCompletionNotice({ kind: 'reconnected_mismatch', message });
          onConnectionNotice?.({ type: 'error', message });
        } else if (outcome.kind === 'already_connected') {
          const message = `This Facebook account (${outcome.accountName}) is already connected — its session was refreshed.`;
          setCompletionNotice({ kind: 'already_connected', message });
          onConnectionNotice?.({ type: 'success', message });
        } else {
          setCompletionNotice(null);
        }

        setView('success');
        onAccountConnected();
        setTimeout(() => {
          onOpenChange(false);
        }, 1500);
      }
    } catch (_e) {
      // Ignored because polling failures are silently retried on the next cycle
    }
  }, [subdomain, onAccountConnected, onConnectionNotice, onOpenChange, reconnectingAccount]);

  // Pure automatic polling every 3 seconds while in magic view and link is not expired
  useEffect(() => {
    if (view !== 'magic' || !open || isLinkExpired) return;

    const pollInterval = setInterval(() => {
      void pollAccounts();
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [view, open, isLinkExpired, pollAccounts]);

  const modalTitle = reconnectingAccount
    ? `Reconnect ${reconnectingAccount.displayName}`
    : 'Connect Facebook Account';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ maxWidth: '500px' }} data-testid="connect-account-modal">
        <DialogHeader>
          <DialogTitle>{modalTitle}</DialogTitle>
          <DialogDescription>
            {view === 'choose' && 'Choose where your Facebook account is currently logged in:'}
            {view === 'magic' && 'Open this link in the browser or mobile device where you are logged into Facebook.'}
            {view === 'success' && 'Account connected successfully!'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {magicError && (
            <div
              style={{
                padding: '8px 12px',
                marginBottom: SPACING.md,
                backgroundColor: 'rgba(246, 70, 93, 0.10)',
                border: '1px solid rgba(246, 70, 93, 0.25)',
                borderRadius: RADII.sm,
                fontSize: '0.8125rem',
                color: PALETTE.accent3,
              }}
            >
              {magicError}
            </div>
          )}

          {view === 'choose' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
              <ConnectOptionButton
                testId="connect-option-direct"
                disabled={isDirectConnecting}
                onClick={handleDirectConnect}
                title={isDirectConnecting ? 'Redirecting to Facebook...' : 'This Browser'}
                description="Choose this if you are already logged into Facebook in this browser window."
                actionHint="Direct Facebook authorization in this window"
                icon={
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                }
              />

              <ConnectOptionButton
                testId="connect-option-magic"
                disabled={isGeneratingMagic}
                onClick={() => {
                  void handleStartMagicLink();
                }}
                title={isGeneratingMagic ? 'Generating Secure Link...' : 'Different Browser or Phone'}
                description="Choose this if your Facebook account is open in another browser, private window, or on your mobile device."
                actionHint="Generates a secure link you can open on any device (valid for 15 minutes)"
                icon={
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                }
              />
            </div>
          )}

          {view === 'magic' && (
            <MagicLinkView
              magicUrl={magicUrl}
              remainingSeconds={remainingSeconds}
              copySuccess={copySuccess}
              isGeneratingMagic={isGeneratingMagic}
              onCopyLink={() => {
                void handleCopyLink();
              }}
              onRegenerateLink={() => {
                void handleStartMagicLink();
              }}
            />
          )}

          {view === 'success' && (
            <ConnectionResultView completionNotice={completionNotice} />
          )}
        </DialogBody>

        <DialogFooter>
          {view === 'magic' && (
            <button
              type="button"
              onClick={() => setView('choose')}
              style={{
                height: '36px',
                padding: `0 ${SPACING.md}`,
                backgroundColor: 'transparent',
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                borderRadius: RADII.sm,
                fontSize: '0.875rem',
                cursor: 'pointer',
                marginRight: 'auto',
              }}
            >
              Back
            </button>
          )}

          <button
            type="button"
            data-testid="connect-close-btn"
            onClick={() => onOpenChange(false)}
            style={{
              height: '36px',
              padding: `0 ${SPACING.md}`,
              backgroundColor: 'transparent',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              borderRadius: RADII.sm,
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            {view === 'success' ? 'Done' : 'Cancel'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
