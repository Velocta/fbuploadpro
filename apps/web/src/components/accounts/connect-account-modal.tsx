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
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';

interface AccountStateRecord {
  status?: string | undefined;
  updatedAt?: string | undefined;
}

interface AccountSnapshot {
  id: string;
  status?: string | undefined;
  updatedAt?: string | undefined;
}

interface ConnectAccountModalProps {
  subdomain: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountConnected: () => void;
  existingAccountIds?: string[];
  reconnectingAccount?: {
    id: string;
    displayName: string;
    status?: string | undefined;
    updatedAt?: string | undefined;
  } | null;
  initialAccounts?: AccountSnapshot[];
}

function formatTimer(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function hasCompletedAccountConnection(
  accounts: AccountSnapshot[],
  initialIds: Set<string>,
  initialStates: Map<string, AccountStateRecord>,
  reconnectingAccount?: ConnectAccountModalProps['reconnectingAccount']
): boolean {
  return accounts.some((acc) => {
    if (!initialIds.has(acc.id)) {
      return true;
    }
    if (reconnectingAccount && acc.id === reconnectingAccount.id) {
      if (acc.status === 'active') return true;
      if (acc.updatedAt && acc.updatedAt !== reconnectingAccount.updatedAt) return true;
    }
    const prevState = initialStates.get(acc.id);
    if (!prevState) return false;
    if (prevState.status === 'expired' && acc.status === 'active') {
      return true;
    }
    return Boolean(acc.updatedAt && prevState.updatedAt && acc.updatedAt !== prevState.updatedAt);
  });
}

interface ConnectOptionButtonProps {
  testId: string;
  disabled: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}

function ConnectOptionButton({
  testId,
  disabled,
  onClick,
  icon,
  title,
  description,
}: Readonly<ConnectOptionButtonProps>) {
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: SPACING.md,
        padding: SPACING.lg,
        backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
        border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
        borderRadius: RADII.md,
        cursor: disabled ? 'not-allowed' : 'pointer',
        textAlign: 'left',
        transition: 'border-color 0.15s ease, background-color 0.15s ease',
        width: '100%',
      }}
    >
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: RADII.sm,
          backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
          border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: PALETTE.primary,
        }}
      >
        {icon}
      </div>

      <div style={{ flex: 1 }}>
        <div
          style={{
            fontWeight: TYPOGRAPHY.weights.semibold,
            fontSize: '0.9375rem',
            color: `var(--text-main, ${THEME.default.text.primary})`,
            marginBottom: '4px',
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
      </div>
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
      <p style={{ margin: 0, fontSize: '0.8125rem', color: `var(--text-sub, ${THEME.default.text.secondary})`, lineHeight: 1.4 }}>
        copy and Open this link in the browser where you&apos;re signed into Facebook:
      </p>

      {isExpired ? (
        <button
          type="button"
          data-testid="magic-regenerate-button"
          disabled={isGeneratingMagic}
          onClick={onRegenerateLink}
          style={{
            height: '38px',
            width: '100%',
            padding: `0 ${SPACING.md}`,
            backgroundColor: PALETTE.primary,
            color: PALETTE.background,
            border: 'none',
            borderRadius: RADII.sm,
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
              fontFamily: 'monospace',
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

const EMPTY_IDS: string[] = [];
const EMPTY_ACCOUNTS: AccountSnapshot[] = [];

export function ConnectAccountModal({
  subdomain,
  open,
  onOpenChange,
  onAccountConnected,
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
    window.location.href = '/api/auth/facebook';
  };

  // Generate Magic Link
  const handleStartMagicLink = async () => {
    setIsGeneratingMagic(true);
    setMagicError(null);
    try {
      const res = await fetch(`/api/tenant/${subdomain}/accounts/magic-link`, {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error('Failed to generate connection link');
      }
      const data = await res.json();
      setMagicUrl(data.magicUrl);
      setRemainingSeconds(data.expiresInSeconds ?? 900);
      setView('magic');
    } catch (_err) {
      // Ignored because generation error is handled via user-facing error state
      setMagicError('Unable to generate magic link. Please try again.');
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

      if (
        hasCompletedAccountConnection(
          accounts,
          initialAccountIdsRef.current,
          initialAccountStatesRef.current,
          reconnectingAccount
        )
      ) {
        setView('success');
        onAccountConnected();
        setTimeout(() => {
          onOpenChange(false);
        }, 1500);
      }
    } catch (_e) {
      // Ignored because polling failures are silently retried on the next cycle
    }
  }, [subdomain, onAccountConnected, onOpenChange, reconnectingAccount]);

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
            {view === 'magic' && 'Open this link in the browser where your Facebook profile is active.'}
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
                title={isDirectConnecting ? 'Redirecting to Facebook...' : 'This browser'}
                description="Choose this if you are already logged into Facebook in this browser."
                icon={
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
                title={isGeneratingMagic ? 'Generating Magic Link...' : 'Different browser or device (Magic Link)'}
                description="Generates a secure single-use link you can paste into another browser or window."
                icon={
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
                  backgroundColor: 'rgba(46, 189, 133, 0.15)',
                  border: '1px solid rgba(46, 189, 133, 0.35)',
                  color: PALETTE.accent4,
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
                Account connected
              </div>
              <div style={{ fontSize: '0.8125rem', color: `var(--text-sub, ${THEME.default.text.secondary})`, marginTop: '4px' }}>
                your facebook account is successfully connected
              </div>
            </div>
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
