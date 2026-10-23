/**
 * Data layer (spec 137 §3.2) — client-safe public surface.
 *
 * `queryKeys` (the only cache-key source), the one-QueryClient factory,
 * and the provider/hydration components. The server-first helpers live
 * in `./server` and are imported directly from server code — they are
 * deliberately not re-exported here so client bundles never pull in
 * server-only modules.
 */
export * from './query-keys';
export * from './query-client';
export * from './provider';
