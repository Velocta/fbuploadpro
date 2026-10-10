'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';

export interface WorkspaceUserMenuProps {
  user?: {
    name: string;
    email: string;
    avatarUrl?: string | undefined;
  } | undefined;
}

function clearClientSessionCookies(): void {
  if (typeof document === 'undefined') return;
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  const rootDomain = parts.length >= 2 ? parts.slice(-2).join('.') : hostname;

  document.cookie = `fbup_session=; Max-Age=0; path=/; domain=.${rootDomain}; SameSite=Lax`;
  document.cookie = 'fbup_session=; Max-Age=0; path=/; SameSite=Lax';
  document.cookie = `fbup_session=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.${rootDomain}; SameSite=Lax`;
  document.cookie = 'fbup_session=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax';
}

function broadcastLogout(): void {
  if (typeof window === 'undefined') return;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('fbup_auth');
      channel.postMessage({ type: 'LOGOUT', timestamp: Date.now() });
      channel.close();
    }
  } catch {
    // Ignore BroadcastChannel errors in unsupported environments
  }

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('fbup_logout_event', String(Date.now()));
    }
  } catch {
    // Ignore localStorage errors
  }
}

function redirectToLogout(): void {
  if (typeof window === 'undefined') return;
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  const rootDomain = parts.length >= 2 ? parts.slice(-2).join('.') : hostname;
  const protocol = window.location.protocol;
  const port = window.location.port ? `:${window.location.port}` : '';
  const isLocal = rootDomain.includes('localhost') || rootDomain.includes('127.0.0.1');
  const isVercelPreview = hostname.endsWith('.vercel.app');

  let targetLoginUrl = '/login?logout=success';
  if (
    !isVercelPreview &&
    ((!isLocal && !hostname.startsWith('app.')) ||
      (isLocal && hostname.includes('.') && !hostname.startsWith('app.')))
  ) {
    targetLoginUrl = `${protocol}//app.${rootDomain}${port}/login?logout=success`;
  }

  window.location.href = targetLoginUrl;
}

export function WorkspaceUserMenu({ user }: Readonly<WorkspaceUserMenuProps>) {
  const { isMobile } = useSidebar();
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isThemeDark, setIsThemeDark] = useState(true);
  const menuRef = useRef<HTMLLIElement>(null);

  const displayName = user?.name || 'Workspace User';
  const displayEmail = user?.email || 'user@example.com';

  // Compute initials (e.g. "John Doe" -> "JD")
  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'U';

  // Outside click and Escape listener to dismiss popover
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Initialize theme from storage or DOM attribute
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const storedTheme =
        typeof localStorage !== 'undefined' ? localStorage.getItem('theme') : null;
      const docTheme = document.documentElement.dataset.theme;
      const activeTheme = storedTheme || docTheme || 'dark';
      setIsThemeDark(activeTheme !== 'light');
      document.documentElement.dataset.theme = activeTheme;
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      setIsSigningOut(true);
      clearClientSessionCookies();
      broadcastLogout();
      try {
        await fetch('/api/auth/logout', { method: 'POST', keepalive: true });
      } catch {
        // Continue even if network is degraded or offline
      }
    } finally {
      redirectToLogout();
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setIsThemeDark((prev) => {
      const nextIsDark = !prev;
      const nextTheme = nextIsDark ? 'dark' : 'light';
      if (typeof document !== 'undefined') {
        document.documentElement.dataset.theme = nextTheme;
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('theme', nextTheme);
          }
        } catch {
          // Ignore storage errors
        }
        document.cookie = `fbup_theme=${nextTheme}; path=/; max-age=31536000; SameSite=Lax`;
      }
      return nextIsDark;
    });
  }, []);

  const renderAvatar = (testId?: string) => (
    <div
      data-testid={testId}
      data-sidebar-icon="true"
      style={{
        width: '32px',
        height: '32px',
        borderRadius: RADII.md,
        backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
        border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.75rem',
        fontWeight: TYPOGRAPHY.weights.semibold,
        color: `var(--text-main, ${THEME.default.text.primary})`,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {initials}
    </div>
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem ref={menuRef}>
        {/* Floating Dropdown Menu (Right-anchored on desktop, top-anchored on mobile) */}
        {isOpen && (
          <div
            role="menu"
            aria-label="User account actions"
            data-testid="workspace-user-popover"
            style={{
              position: 'absolute',
              bottom: isMobile ? 'calc(100% + 8px)' : 0,
              left: isMobile ? 0 : 'calc(100% + 8px)',
              right: isMobile ? 0 : 'auto',
              width: isMobile ? '100%' : '240px',
              minWidth: '224px',
              backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
              border: `1px solid var(--border-strong, ${THEME.default.borders.strong})`,
              borderRadius: RADII.md,
              boxShadow: `var(--shadow-elevated, ${THEME.default.shadows.elevated})`,
              padding: SPACING.xs,
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              boxSizing: 'border-box',
            }}
          >
            {/* User Identity Header (Shadcn DropdownMenuLabel Pattern) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACING.sm,
                padding: `${SPACING.xs} ${SPACING.sm}`,
                textAlign: 'left',
                fontSize: '0.875rem',
              }}
            >
              {renderAvatar()}
              <div
                style={{
                  display: 'grid',
                  flex: 1,
                  textAlign: 'left',
                  fontSize: '0.875rem',
                  lineHeight: 1.25,
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    fontWeight: TYPOGRAPHY.weights.semibold,
                    color: `var(--text-main, ${THEME.default.text.primary})`,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {displayName}
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: `var(--text-dim, ${THEME.default.text.muted})`,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {displayEmail}
                </span>
              </div>
            </div>

            <div
              style={{
                height: '1px',
                backgroundColor: `var(--border-subtle, ${THEME.default.borders.hairline})`,
                margin: `${SPACING.xs} 0`,
              }}
              aria-hidden="true"
            />

            {/* Theme Toggle Action */}
            <button
              type="button"
              role="menuitem"
              className="sidebar-dropdown-item"
              data-testid="workspace-theme-toggle"
              onClick={toggleTheme}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: `6px ${SPACING.sm}`,
                borderRadius: RADII.xs,
                border: 'none',
                backgroundColor: 'transparent',
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background-color 0.12s ease, color 0.12s ease',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2" />
                  <path d="M12 20v2" />
                  <path d="m4.93 4.93 1.41 1.41" />
                  <path d="m17.66 17.66 1.41 1.41" />
                  <path d="M2 12h2" />
                  <path d="M20 12h2" />
                  <path d="m6.34 17.66-1.41 1.41" />
                  <path d="m19.07 4.93-1.41 1.41" />
                </svg>
                <span>Theme</span>
              </span>
              <span
                style={{
                  fontSize: '0.6875rem',
                  color: `var(--text-dim, ${THEME.default.text.muted})`,
                  textTransform: 'uppercase',
                  letterSpacing: TYPOGRAPHY.tracking.caption,
                }}
              >
                {isThemeDark ? 'Dark' : 'Light'}
              </span>
            </button>

            <div
              style={{
                height: '1px',
                backgroundColor: `var(--border-subtle, ${THEME.default.borders.hairline})`,
                margin: `${SPACING.xs} 0`,
              }}
              aria-hidden="true"
            />

            {/* Sign Out Action */}
            <button
              type="button"
              role="menuitem"
              className="sidebar-dropdown-item"
              data-testid="workspace-sign-out"
              disabled={isSigningOut}
              onClick={handleSignOut}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACING.sm,
                width: '100%',
                padding: `6px ${SPACING.sm}`,
                borderRadius: RADII.xs,
                border: 'none',
                backgroundColor: 'transparent',
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                fontSize: '0.8125rem',
                cursor: isSigningOut ? 'not-allowed' : 'pointer',
                textAlign: 'left',
                transition: 'background-color 0.12s ease, color 0.12s ease',
              }}
              onMouseEnter={(e) => {
                if (!isSigningOut) {
                  e.currentTarget.style.color = PALETTE.primary;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = `var(--text-sub, ${THEME.default.text.secondary})`;
              }}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" x2="9" y1="12" y2="12" />
              </svg>
              <span>{isSigningOut ? 'Signing out...' : 'Sign out'}</span>
            </button>
          </div>
        )}

        {/* User Profile Button (Shadcn NavUser SidebarMenuButton size="lg") */}
        <SidebarMenuButton
          size="lg"
          aria-label="User menu"
          aria-haspopup="true"
          aria-expanded={isOpen}
          data-testid="workspace-user-caret"
          tooltip={displayName}
          isActive={isOpen}
          onClick={() => setIsOpen((prev) => !prev)}
        >
          {renderAvatar('workspace-user-avatar')}

          <div
            style={{
              display: 'grid',
              flex: 1,
              textAlign: 'left',
              fontSize: '0.875rem',
              lineHeight: 1.25,
              minWidth: 0,
            }}
          >
            <span
              style={{
                fontWeight: TYPOGRAPHY.weights.semibold,
                color: `var(--text-main, ${THEME.default.text.primary})`,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {displayName}
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                color: `var(--text-dim, ${THEME.default.text.muted})`,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {displayEmail}
            </span>
          </div>

          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{
              marginLeft: 'auto',
              flexShrink: 0,
              color: `var(--text-dim, ${THEME.default.text.muted})`,
            }}
          >
            <path d="m7 15 5 5 5-5" />
            <path d="m7 9 5-5 5 5" />
          </svg>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
