/**
 * Auth library (spec 137 §3.2.5) — the focused modules that replaced
 * the former 1,314-line auth monolith.
 *
 * Production code imports each symbol from its owning module
 * (`@/lib/auth/clients`, `@/lib/auth/users`, …); this barrel exists
 * for test suites that exercise the auth surface as a whole. It is
 * NOT a re-export of the old path — the monolith file is deleted
 * and nothing may import it.
 */
export * from './email';
export * from './passwords';
export * from './clients';
export * from './stores';
export * from './users';
export * from './workspaces';
export * from './signup';
export * from './login';
export * from './password-reset';
export * from './session';
