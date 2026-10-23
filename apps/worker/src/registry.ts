import { createPublisherRegistry, type PublisherRegistry } from '@fbuploadpro/contracts';
import { PostForMeClient } from './providers/post-for-me.js';
import { PostForMeYouTubeClient } from './providers/post-for-me-youtube.js';
import { FacebookPublisher } from './publishers/facebook.js';
import { InstagramPublisher } from './publishers/instagram.js';
import { ThreadsPublisher } from './publishers/threads.js';
import { XPublisher } from './publishers/x.js';
import { YouTubePublisher } from './publishers/youtube.js';

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
 *
 * The optional env bag carries the worker-env credentials the global /
 * provider-managed platforms read (spec 127 X: our own single app's
 * client ID/secret from GitHub Secrets → worker env, D7 — never the
 * database; spec 125/126's Post-for-Me key rides the same bag). Values
 * are passed structurally so tests can inject fakes and the registry
 * never reads `process.env` itself.
 *
 * Spec 125 registers YouTube when the Post for Me API key is present
 * in worker env. When the key is absent, YouTube is deliberately NOT
 * registered — the safer behaviour, since a registered publisher
 * with no key could only fail every item auth-class and cascade
 * accounts to `expired`, while unregistered items simply stay queued
 * until the key is configured.
 */
export interface WorkerPublisherEnv {
  /** Post-for-Me provider API key (specs 125/126) — env only, never a table. */
  POST_FOR_ME_API_KEY?: string | undefined;
  /** X global-app client ID (spec 127, D7) — env only, never a table. */
  X_CLIENT_ID?: string | undefined;
  /** X global-app client secret (spec 127, D7) — env only, never a table. */
  X_CLIENT_SECRET?: string | undefined;
  /** PostHog key for worker analytics (spec 118) — the X publisher's 402 seam. */
  POSTHOG_KEY?: string | undefined;
  /** PostHog host for worker analytics (spec 118). */
  POSTHOG_HOST?: string | undefined;
}

export function createWorkerPublisherRegistry(
  env?: WorkerPublisherEnv
): PublisherRegistry {
  const registry = createPublisherRegistry();
  registry.register(new FacebookPublisher());
  registry.register(new InstagramPublisher());
  registry.register(new ThreadsPublisher());
  registry.register(
    new XPublisher(undefined, {
      clientId: env?.X_CLIENT_ID,
      clientSecret: env?.X_CLIENT_SECRET,
      env: {
        ...(env?.POSTHOG_KEY ? { POSTHOG_KEY: env.POSTHOG_KEY } : {}),
        ...(env?.POSTHOG_HOST ? { POSTHOG_HOST: env.POSTHOG_HOST } : {}),
      },
    })
  );

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
