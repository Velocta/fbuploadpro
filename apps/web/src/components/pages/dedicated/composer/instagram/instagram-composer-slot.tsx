'use client';

import React from 'react';
import { DestinationComposerSlotShell } from '../destination/destination-slot-shell';
import {
  InstagramComposer,
  type InstagramComposerDestination,
} from './instagram-composer';

/**
 * Frame mount for the Instagram composer set (spec 132 PR-C3): the
 * 131-4 destination frame renders this in its composer slot for
 * Instagram destinations. Account type is not surfaced on the
 * destination read today, so it is not passed — Stories stay
 * unoffered (the §4.1 fallback) until it is.
 */
export interface InstagramComposerSlotProps {
  subdomain: string;
  destination: InstagramComposerDestination;
}

export function InstagramComposerSlot({
  subdomain,
  destination,
}: Readonly<InstagramComposerSlotProps>) {
  return (
    <DestinationComposerSlotShell
      testIdPrefix="instagram-composer"
      launchDescription={`Create a photo, Reel or carousel for ${destination.name} — post it now, schedule it, or add it to the queue.`}
      renderComposer={({ onClose, onSubmitted }) => (
        <InstagramComposer
          subdomain={subdomain}
          destination={destination}
          onClose={onClose}
          onSubmitted={onSubmitted}
        />
      )}
    />
  );
}
