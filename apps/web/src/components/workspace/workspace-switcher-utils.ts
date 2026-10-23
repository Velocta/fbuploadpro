/**
 * Workspace switcher — shared helpers for the decomposed footer
 * modules (spec 130 §5.3, PR-130-2b). These helpers carried real
 * external consumers in the deleted `workspace-studio-footer.tsx`
 * (`broadcastLogout`, `getMonogram`, `resolveActiveWorkspace`); they
 * live here now and the switcher modules + tests import them from
 * this module. No re-export shim of the old path exists.
 */

import { buildCentralAppUrl } from '@fbuploadpro/contracts';
import { broadcastAuthEvent } from '@/lib/auth-broadcast';
import { getUserInitials } from '@/lib/user-initials';
import type { WorkspaceItem } from '@/lib/api/schemas/workspaces';

export type { WorkspaceItem };

/**
 * Letter computation is shared via getUserInitials from
 * '@/lib/user-initials'; this helper preserves the historical 'WS'
 * empty-name fallback the footer has always presented.
 */
export function getMonogram(name: string): string {
  const initials = getUserInitials(name);
  return initials === '?' ? 'WS' : initials;
}

export function broadcastLogout(): void {
  broadcastAuthEvent({ type: 'LOGOUT' });
}

export function resolveActiveWorkspace(
  workspaces: WorkspaceItem[],
  currentSubdomain: string,
  fallbackName?: string | undefined
): WorkspaceItem {
  const found = workspaces.find(
    (w) => w.subdomain.toLowerCase() === currentSubdomain.toLowerCase()
  );
  if (found) return found;
  return {
    id: 'active',
    ownerId: 'active',
    // Never present the bare internal slug as the workspace name when
    // a display name is known.
    name: fallbackName || currentSubdomain,
    subdomain: currentSubdomain,
  };
}

export function clearClientSessionCookies(): void {
  if (typeof document === 'undefined') return;
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  const rootDomain = parts.length >= 2 ? parts.slice(-2).join('.') : hostname;

  document.cookie = `fbup_session=; Max-Age=0; path=/; domain=.${rootDomain}; SameSite=Lax`;
  document.cookie = 'fbup_session=; Max-Age=0; path=/; SameSite=Lax';
  document.cookie = `fbup_session=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.${rootDomain}; SameSite=Lax`;
  document.cookie = 'fbup_session=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax';
}

export function redirectToLogout(): void {
  if (typeof window === 'undefined') return;
  const targetLoginUrl = buildCentralAppUrl(
    '/login?logout=success',
    window.location.href,
    process.env.NEXT_PUBLIC_ROOT_DOMAIN
  ).toString();

  window.location.href = targetLoginUrl;
}
