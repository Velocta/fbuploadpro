'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { DestinationComposerSlotShell } from '../destination/destination-slot-shell';
import type { InstagramComposerDestination } from './instagram-composer';

/**
 * The composer itself is loaded on demand (spec 137 §3.6.1): the slot
 * ships only the launch shell in the destination route's first load,
 * and the composer framework (form, media area, contracts validators)
 * arrives when the user actually opens it.
 */
const InstagramComposer = dynamic(
  () =>
    import('./instagram-composer').then((m) => ({
      default: m.InstagramComposer,
    })),
  { ssr: false }
);

/**
 * Frame mount for the Instagram composer set (spec 132 PR-C3): the
 * 131-4 destination frame renders this in its composer slot for
 * Instagram destinations. The frame passes the destination's
 * persisted account type (surfaced on the destination detail from
 * `destinations.metadata`), so a known-Business destination is
 * offered Stories; Creator and unknown destinations are not
 * (the §4.1 gate).
 */
export interface InstagramComposerSlotProps {
  subdomain: string;
  destination: InstagramComposerDestination;
  /** The destination's Instagram account type, when known. */
  accountType?: string | null | undefined;
}

export function InstagramComposerSlot({
  subdomain,
  destination,
  accountType,
}: Readonly<InstagramComposerSlotProps>) {
  return (
    <DestinationComposerSlotShell
      testIdPrefix="instagram-composer"
      launchDescription={`Create a photo, Reel or carousel for ${destination.name} — post it now, schedule it, or add it to the queue.`}
      renderComposer={({ onClose, onSubmitted }) => (
        <InstagramComposer
          subdomain={subdomain}
          destination={destination}
          accountType={accountType}
          onClose={onClose}
          onSubmitted={onSubmitted}
        />
      )}
    />
  );
}
