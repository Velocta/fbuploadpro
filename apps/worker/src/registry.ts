import { createPublisherRegistry, type PublisherRegistry } from '@fbuploadpro/contracts';
import { FacebookPublisher } from './publishers/facebook.js';
import { InstagramPublisher } from './publishers/instagram.js';
import { ThreadsPublisher } from './publishers/threads.js';

/**
 * Builds the worker's publisher registry (spec 121 Scope 1).
 *
 * Spec 122 registers Facebook here (the existing `fb-client.ts` behind
 * the `Publisher` interface — see `publishers/facebook.ts`); spec 124
 * registers Instagram and Threads; specs 125–127 register YouTube,
 * TikTok, and X.
 *
 * Because claiming is registry-driven, a platform with no registered
 * publisher is never claimed and never reaches a consumer: its items
 * stay `queued` until its platform spec lands.
 */
export function createWorkerPublisherRegistry(): PublisherRegistry {
  const registry = createPublisherRegistry();
  registry.register(new FacebookPublisher());
  registry.register(new InstagramPublisher());
  registry.register(new ThreadsPublisher());
  return registry;
}
