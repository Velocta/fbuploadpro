'use client';

import React from 'react';
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
import type { FacebookAccountItem } from './account-card';

interface DisconnectAccountDialogProps {
  account: FacebookAccountItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (accountId: string) => Promise<void>;
  isDisconnecting?: boolean;
}

export function DisconnectAccountDialog({
  account,
  open,
  onOpenChange,
  onConfirm,
  isDisconnecting = false,
}: Readonly<DisconnectAccountDialogProps>) {
  if (!account) return null;

  const handleConfirm = async () => {
    await onConfirm(account.id);
  };

  const pagesCount = account.connectedPagesCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ maxWidth: '460px' }}>
        <DialogHeader>
          <DialogTitle>Disconnect {account.displayName}?</DialogTitle>
          <DialogDescription>
            This Account will no longer be available
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div
            style={{
              padding: SPACING.md,
              backgroundColor: 'rgba(246, 70, 93, 0.08)',
              border: '1px solid rgba(246, 70, 93, 0.25)',
              borderRadius: RADII.sm,
              fontSize: '0.8125rem',
              lineHeight: 1.5,
              color: `var(--text-main, ${THEME.default.text.primary})`,
            }}
          >
            <p style={{ margin: '0 0 8px 0', fontWeight: TYPOGRAPHY.weights.semibold, color: PALETTE.accent3 }}>
              Before you disconnect
            </p>
            <p style={{ margin: 0 }}>
              <strong>{pagesCount} linked {pagesCount === 1 ? 'Facebook page' : 'Facebook pages'}</strong> will be Removed, and any scheduled content on them will be removed as well.
            </p>
          </div>
        </DialogBody>

        <DialogFooter>
          <button
            type="button"
            data-testid="disconnect-cancel-btn"
            disabled={isDisconnecting}
            onClick={() => onOpenChange(false)}
            style={{
              height: '36px',
              padding: `0 ${SPACING.md}`,
              backgroundColor: 'transparent',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              borderRadius: RADII.sm,
              fontSize: '0.875rem',
              fontWeight: TYPOGRAPHY.weights.medium,
              cursor: isDisconnecting ? 'not-allowed' : 'pointer',
              opacity: isDisconnecting ? 0.6 : 1,
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            data-testid="disconnect-confirm-btn"
            disabled={isDisconnecting}
            onClick={handleConfirm}
            style={{
              height: '36px',
              padding: `0 ${SPACING.md}`,
              backgroundColor: PALETTE.accent3,
              color: '#ffffff',
              border: 'none',
              borderRadius: RADII.sm,
              fontSize: '0.875rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              cursor: isDisconnecting ? 'not-allowed' : 'pointer',
              opacity: isDisconnecting ? 0.7 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: SPACING.xs,
            }}
          >
            {isDisconnecting ? 'Disconnecting...' : 'Disconnect Account'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
