/**
 * Email validation + PostgREST filter escaping (spec 137 §3.2.5 split).
 *
 * Split from the former 1,314-line auth monolith
 * by spec 137 PR-A1b (audit #6 / spec §3.2.5). Function bodies are
 * verbatim; only imports/exports were re-wired to the new modules.
 */

import { canonicalizeGmailAddress } from '@fbuploadpro/contracts';

/**
 * Validates and canonicalizes email addresses, strictly rejecting characters that could be used
 * for PostgREST filter delimiter injection (such as commas, parentheses, quotes, backslashes, semicolons, spaces).
 */
export function sanitizeEmailInput(emailInput: string): string {
  if (!emailInput || typeof emailInput !== 'string') {
    throw new Error('Valid email address is required');
  }
  const trimmed = emailInput.trim().toLowerCase();
  // Reject characters used to craft PostgREST query injection or control flow
  if (/[,()"'\\;\s]/.test(trimmed)) {
    throw new Error('Email address contains invalid characters');
  }
  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 0 || atIndex !== trimmed.lastIndexOf('@') || atIndex === trimmed.length - 1) {
    throw new Error('Valid email address is required');
  }
  return trimmed;
}

/**
 * Resolves a canonical email address: attempts canonicalizeGmailAddress, and falls back to sanitizeEmailInput.
 */
export function resolveCanonicalEmail(emailInput: string): string {
  try {
    return canonicalizeGmailAddress(emailInput);
  } catch {
    return sanitizeEmailInput(emailInput);
  }
}

/**
 * Escapes and safely quotes a value for use in a PostgREST `.or()` filter.
 */
export function escapePostgrestFilterValue(val: string): string {
  const escaped = val
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"');
  return `"${escaped}"`;
}
