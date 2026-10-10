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

interface ConnectAccountModalProps {
  subdomain: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountConnected: () => void;
  existingAccountIds?: string[];
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

export function ConnectAccountModal({
  subdomain,
  open,
  onOpenChange,
  onAccountConnected,
  existingAccountIds = [],
}: Readonly<ConnectAccountModalProps>) {
  const [view, setView] = useState<'choose' | 'magic' | 'success'>('choose');
  const [isDirectConnecting, setIsDirectConnecting] = useState(false);
  const [magicUrl, setMagicUrl] = useState<string | null>(null);
  const [isGeneratingMagic, setIsGeneratingMagic] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(900); // 15 minutes
  const [magicError, setMagicError] = useState<string | null>(null);

  const initialAccountIdsRef = useRef<Set<string>>(new Set(existingAccountIds));

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setView('choose');
      setIsDirectConnecting(false);
      setMagicUrl(null);
      setCopySuccess(false);
      setRemainingSeconds(900);
      setMagicError(null);
      initialAccountIdsRef.current = new Set(existingAccountIds);
    }
  }, [open, existingAccountIds]);

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

  // Live countdown timer for Magic Link
  useEffect(() => {
    if (view !== 'magic' || !open) return;
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
  }, [view, open]);

  // Format countdown mm:ss
  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Check for newly connected account
  const pollAccounts = useCallback(async () => {
    try {
      const res = await fetch(`/api/tenant/${subdomain}/accounts`);
      if (!res.ok) return;
      const data = await res.json();
      const accounts = data.accounts || [];

      // Detect if an account not present in initialAccountIdsRef now exists
      const hasNewAccount = accounts.some(
        (acc: { id: string }) => !initialAccountIdsRef.current.has(acc.id)
      );

      if (hasNewAccount) {
        setView('success');
        onAccountConnected();
        setTimeout(() => {
          onOpenChange(false);
        }, 1500);
      }
    } catch (_e) {
      // Ignored because polling failures are silently retried on the next cycle
    }
  }, [subdomain, onAccountConnected, onOpenChange]);

  // Pure automatic polling every 3 seconds while in magic view
  useEffect(() => {
    if (view !== 'magic' || !open) return;

    const pollInterval = setInterval(() => {
      void pollAccounts();
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [view, open, pollAccounts]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ maxWidth: '500px' }} data-testid="connect-account-modal">
        <DialogHeader>
          <DialogTitle>Connect Facebook Account</DialogTitle>
          <DialogDescription>
            {view === 'choose' && 'Select how you would like to connect your Facebook profile.'}
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
                title={isDirectConnecting ? 'Redirecting to Facebook...' : 'Connect in this browser'}
                description="Use this option if you are already signed into your Facebook profile in this browser window."
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
                onClick={handleStartMagicLink}
                title={isGeneratingMagic ? 'Generating Magic Link...' : 'Connect via Magic Link'}
                description="Use this option if your Facebook account is open in another browser, incognito window, or profile."
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: `var(--text-sub, ${THEME.default.text.secondary})`, lineHeight: 1.4 }}>
                Copy this single-use link and paste it into the browser where your target Facebook account is logged in:
              </p>

              {/* Copyable Link Field */}
              <div style={{ display: 'flex', gap: SPACING.xs, alignItems: 'center' }}>
                <input
                  type="text"
                  readOnly
                  data-testid="magic-url-input"
                  value={magicUrl ?? ''}
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
                  }}
                />

                <button
                  type="button"
                  data-testid="magic-copy-button"
                  onClick={handleCopyLink}
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
                      backgroundColor: PALETTE.primary,
                      display: 'inline-block',
                    }}
                  />
                  <span>Waiting for authorization in other browser...</span>
                </div>

                <span data-testid="magic-countdown" style={{ fontWeight: TYPOGRAPHY.weights.medium }}>
                  Expires in {formatTimer(remainingSeconds)}
                </span>
              </div>
            </div>
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
                Connected!
              </div>
              <div style={{ fontSize: '0.8125rem', color: `var(--text-sub, ${THEME.default.text.secondary})`, marginTop: '4px' }}>
                Your Facebook profile has been linked to this workspace.
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
