import { createPublisherRegistry, type PublisherRegistry } from '@fbuploadpro/contracts';
import { FacebookPublisher } from './publishers/facebook.js';

/**
 * Builds the worker's publisher registry (spec 121 Scope 1).
 *
 * Spec 122 registers Facebook here (the existing `fb-client.ts` behind
 * the `Publisher` interface — see `publishers/facebook.ts`); specs
 * 124–127 register Instagram/Threads, YouTube, TikTok, and X.
 *
 * Because claiming is registry-driven, a platform with no registered
 * publisher is never claimed and never reaches a consumer: its items
 * stay `queued` until its platform spec lands.
 */
export function createWorkerPublisherRegistry(): PublisherRegistry {
  const registry = createPublisherRegistry();
  registry.register(new FacebookPublisher());
  return registry;
}
