import { createPublisherRegistry, type PublisherRegistry } from '@fbuploadpro/contracts';
import { PostForMeClient } from './providers/post-for-me.js';
import { PostForMeYouTubeClient } from './providers/post-for-me-youtube.js';
import { FacebookPublisher } from './publishers/facebook.js';
import { YouTubePublisher } from './publishers/youtube.js';

/**
 * Worker env values the registry may consume. A local structural
 * interface (not the worker Env) so each platform spec adds only its
 * own optional keys: Post for Me's key here (spec 125).
 */
export interface WorkerRegistryEnv {
  POST_FOR_ME_API_KEY?: string;
}

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
 *
 * Spec 125 registers YouTube when the Post for Me API key is present
 * in worker env. When the key is absent, YouTube is deliberately NOT
 * registered — the safer behaviour, since a registered publisher
 * with no key could only fail every item auth-class and cascade
 * accounts to `expired`, while unregistered items simply stay queued
 * until the key is configured.
 */
export function createWorkerPublisherRegistry(
  env?: WorkerRegistryEnv
): PublisherRegistry {
  const registry = createPublisherRegistry();
  registry.register(new FacebookPublisher());

  const postForMeApiKey = env?.POST_FOR_ME_API_KEY;
  if (postForMeApiKey) {
    registry.register(
      new YouTubePublisher(
        new PostForMeYouTubeClient(new PostForMeClient({ apiKey: postForMeApiKey }))
      )
    );
  } else {
    console.warn(
      '[registry] POST_FOR_ME_API_KEY is not configured; YouTube publishing is disabled and YouTube items will stay queued.'
    );
  }

  return registry;
}
