import { createPublisherRegistry, type PublisherRegistry } from '@fbuploadpro/contracts';

/**
 * Builds the worker's publisher registry (spec 121 Scope 1).
 *
 * Deliberately EMPTY of platform modules in this PR: spec 121 ships the
 * pipeline (claimer, queues, consumers), and each platform spec registers
 * its own publisher here — spec 122 registers Facebook (moving the
 * existing `fb-client.ts` behind the `Publisher` interface), specs
 * 124–127 register Instagram/Threads, YouTube, TikTok, and X.
 *
 * Because claiming is registry-driven, a platform with no registered
 * publisher is never claimed and never reaches a consumer: its items
 * stay `queued` until its platform spec lands. That is what makes the
 * deploy order safe to state plainly — this PR must land together with
 * spec 122 in one release sequence, because until 122 registers the
 * Facebook publisher, production Facebook items are not claimed by the
 * new claimer either.
 */
export function createWorkerPublisherRegistry(): PublisherRegistry {
  const registry = createPublisherRegistry();
  // Spec 122: registry.register(new FacebookPublisher(...));
  return registry;
}
