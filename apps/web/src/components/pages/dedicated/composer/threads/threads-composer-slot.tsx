'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { DestinationComposerSlotShell } from '../destination/destination-slot-shell';
import type { ThreadsComposerDestination } from './threads-composer';

/**
 * The composer itself is loaded on demand (spec 137 §3.6.1): the slot
 * ships only the launch shell in the destination route's first load,
 * and the composer framework arrives when the user actually opens it
 * (the PR-C3 bundle-budget lesson).
 */
const ThreadsComposer = dynamic(
  () =>
    import('./threads-composer').then((m) => ({
      default: m.ThreadsComposer,
    })),
  { ssr: false }
);

/**
 * Frame mount for the Threads composer set (spec 132 PR-C4): the 131-4
 * destination frame renders this in its composer slot for Threads
 * destinations.
 */
export interface ThreadsComposerSlotProps {
  subdomain: string;
  destination: ThreadsComposerDestination;
}

export function ThreadsComposerSlot({
  subdomain,
  destination,
}: Readonly<ThreadsComposerSlotProps>) {
  return (
    <DestinationComposerSlotShell
      testIdPrefix="threads-composer"
      launchDescription={`Write a text post or share photos and videos with ${destination.name} — post it now, schedule it, or add it to the queue.`}
      renderComposer={({ onClose, onSubmitted }) => (
        <ThreadsComposer
          subdomain={subdomain}
          destination={destination}
          onClose={onClose}
          onSubmitted={onSubmitted}
        />
      )}
    />
  );
}
