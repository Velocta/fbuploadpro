'use client';

import React, { useState } from 'react';
import { Banner } from '@/components/shared/ui/banner';
import { Button } from '@/components/shared/ui/button';

/**
 * The frame-side host for a destination composer (spec 132 T-G0
 * determination, recorded in the PR): the 131-4 frame's composer slot
 * renders this shell for platforms whose composer set has landed. The
 * shell owns the launch state and the success notification — the same
 * host contract the Facebook page section gives its composer
 * (`onClose` / `onSubmitted(message)`) — and the platform composer
 * itself renders in place of the launch panel while open, so the
 * composer is a full-page form in the slot, never a dialog
 * (OD132-1 (a)).
 */
export interface DestinationComposerHandlers {
  onClose: () => void;
  onSubmitted: (message: string) => void;
}

export interface DestinationComposerSlotShellProps {
  /** e.g. "instagram-composer" — test id root for the launch state. */
  testIdPrefix: string;
  /** Launch-state line naming what can be created here. */
  launchDescription: string;
  renderComposer: (handlers: DestinationComposerHandlers) => React.ReactNode;
}

export function DestinationComposerSlotShell({
  testIdPrefix,
  launchDescription,
  renderComposer,
}: Readonly<DestinationComposerSlotShellProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (isOpen) {
    return (
      <>
        {renderComposer({
          onClose: () => setIsOpen(false),
          onSubmitted: (message) => {
            setSuccessMessage(message);
            setIsOpen(false);
          },
        })}
      </>
    );
  }

  return (
    <div data-testid={`${testIdPrefix}-launch`} className="flex flex-col gap-3">
      {successMessage && (
        <Banner
          variant="success"
          title={successMessage}
          onDismiss={() => setSuccessMessage(null)}
        />
      )}
      <p className="m-0 text-body text-ink-sub">{launchDescription}</p>
      <div>
        <Button
          type="button"
          data-testid={`${testIdPrefix}-open-btn`}
          onClick={() => setIsOpen(true)}
        >
          Create post
        </Button>
      </div>
    </div>
  );
}
