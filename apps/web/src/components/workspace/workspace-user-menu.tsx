'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';
import { useSidebar } from '@/components/ui/sidebar';

export interface WorkspaceUserMenuProps {
  user?: {
    name: string;
    email: string;
    avatarUrl?: string | undefined;
  } | undefined;
}

export function WorkspaceUserMenu({ user }: WorkspaceUserMenuProps) {
  const { state, isMobile } = useSidebar();
  const isCollapsed = !isMobile && state === 'collapsed';
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isThemeDark, setIsThemeDark] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  const displayName = user?.name || 'Workspace User';
  const displayEmail = user?.email || 'user@example.com';

  // Compute initials (e.g. "John Doe" -> "JD")
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U';

  // Outside click listener to dismiss popover
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
      const storedTheme = typeof localStorage !== 'undefined' ? localStorage.getItem('theme') : null;
      const docTheme = document.documentElement.getAttribute('data-theme');
      const activeTheme = storedTheme || docTheme || 'dark';
      setIsThemeDark(activeTheme !== 'light');
      document.documentElement.setAttribute('data-theme', activeTheme);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      setIsSigningOut(true);

      // 1. Proactively expire client-side session cookies (both root domain and local origin)
      if (typeof document !== 'undefined') {
        const hostname = window.location.hostname;
        const parts = hostname.split('.');
        const rootDomain = parts.length >= 2 ? parts.slice(-2).join('.') : hostname;

        document.cookie = `fbup_session=; Max-Age=0; path=/; domain=.${rootDomain}; SameSite=Lax`;
        document.cookie = 'fbup_session=; Max-Age=0; path=/; SameSite=Lax';
        document.cookie = `fbup_session=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.${rootDomain}; SameSite=Lax`;
        document.cookie = 'fbup_session=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax';
      }

      // 2. Broadcast logout across all open tabs
      if (typeof window !== 'undefined') {
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

      // 3. Fire server logout API with keepalive
      try {
        await fetch('/api/auth/logout', { method: 'POST', keepalive: true });
      } catch {
        // Continue even if network is degraded or offline
      }
    } finally {
      // 4. Navigate directly to canonical central gateway with ?logout=success
      if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        const parts = hostname.split('.');
        const rootDomain = parts.length >= 2 ? parts.slice(-2).join('.') : hostname;
        const protocol = window.location.protocol;
        const port = window.location.port ? `:${window.location.port}` : '';
        const isLocal = rootDomain.includes('localhost') || rootDomain.includes('127.0.0.1');

        let targetLoginUrl = '/login?logout=success';
        if (!isLocal && !hostname.startsWith('app.')) {
          targetLoginUrl = `${protocol}//app.${rootDomain}${port}/login?logout=success`;
        } else if (isLocal && hostname.includes('.') && !hostname.startsWith('app.')) {
          targetLoginUrl = `${protocol}//app.${rootDomain}${port}/login?logout=success`;
        }

        window.location.href = targetLoginUrl;
      }
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setIsThemeDark((prev) => {
      const nextIsDark = !prev;
      const nextTheme = nextIsDark ? 'dark' : 'light';
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', nextTheme);
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('theme', nextTheme);
          }
        } catch {}
        document.cookie = `fbup_theme=${nextTheme}; path=/; max-age=31536000; SameSite=Lax`;
      }
      return nextIsDark;
    });
  }, []);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'relative',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Popover Menu Anchored Above Footer */}
      {isOpen && (
        <div
          role="menu"
          aria-label="User account actions"
          data-testid="workspace-user-popover"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: isCollapsed ? '52px' : 0,
            right: isCollapsed ? 'auto' : 0,
            width: isCollapsed ? '240px' : '100%',
            backgroundColor: THEME.default.surfaces.panel,
            border: `1px solid ${THEME.default.borders.hairline}`,
            borderRadius: RADII.md,
            boxShadow: THEME.default.shadows.elevated,
            padding: SPACING.xs,
            zIndex: 60,
            maxHeight: 'calc(100vh - 80px)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            boxSizing: 'border-box',
          }}
        >
          {/* Identity Header */}
          <div
            style={{
              padding: `${SPACING.sm} ${SPACING.sm}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            }}
          >
            <div
              style={{
                fontSize: '0.8125rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                color: THEME.default.text.primary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {displayName}
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                color: THEME.default.text.muted,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {displayEmail}
            </div>
          </div>

          <div
            style={{
              height: '1px',
              backgroundColor: THEME.default.borders.hairline,
              margin: `${SPACING.xs} 0`,
            }}
            aria-hidden="true"
          />

          {/* Theme Toggle Button */}
          <button
            type="button"
            role="menuitem"
            data-testid="workspace-theme-toggle"
            onClick={toggleTheme}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: `${SPACING.xs} ${SPACING.sm}`,
              borderRadius: RADII.xs,
              border: 'none',
              backgroundColor: 'transparent',
              color: THEME.default.text.secondary,
              fontSize: '0.8125rem',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background-color 0.12s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = THEME.default.surfaces.hover;
              e.currentTarget.style.color = THEME.default.text.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = THEME.default.text.secondary;
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
                color: THEME.default.text.muted,
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
              backgroundColor: THEME.default.borders.hairline,
              margin: `${SPACING.xs} 0`,
            }}
            aria-hidden="true"
          />

          {/* Sign Out Action */}
          <button
            type="button"
            role="menuitem"
            data-testid="workspace-sign-out"
            disabled={isSigningOut}
            onClick={handleSignOut}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: SPACING.sm,
              width: '100%',
              padding: `${SPACING.xs} ${SPACING.sm}`,
              borderRadius: RADII.xs,
              border: 'none',
              backgroundColor: 'transparent',
              color: THEME.default.text.secondary,
              fontSize: '0.8125rem',
              cursor: isSigningOut ? 'not-allowed' : 'pointer',
              textAlign: 'left',
              transition: 'background-color 0.12s ease',
            }}
            onMouseEnter={(e) => {
              if (!isSigningOut) {
                e.currentTarget.style.backgroundColor = THEME.default.surfaces.hover;
                e.currentTarget.style.color = PALETTE.primary;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = THEME.default.text.secondary;
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" x2="9" y1="12" y2="12" />
            </svg>
            <span>{isSigningOut ? 'Signing out...' : 'Sign out'}</span>
          </button>
        </div>
      )}

      {/* Main Profile Anchor Card */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          gap: isCollapsed ? 0 : SPACING.sm,
          width: '100%',
          padding: isCollapsed ? `${SPACING.xs} 0` : `${SPACING.xs} ${SPACING.sm}`,
          borderRadius: RADII.sm,
          backgroundColor: isOpen ? THEME.default.surfaces.active : 'transparent',
          transition: 'background-color 0.12s ease',
          boxSizing: 'border-box',
        }}
      >
        {/* User Identity Info */}
        <div
          role={isCollapsed ? 'button' : undefined}
          tabIndex={isCollapsed ? 0 : undefined}
          onClick={() => isCollapsed && setIsOpen((prev) => !prev)}
          onKeyDown={(e) => {
            if (isCollapsed && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              setIsOpen((prev) => !prev);
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACING.sm,
            minWidth: 0,
            cursor: isCollapsed ? 'pointer' : 'default',
          }}
        >
          {/* Avatar with Initials */}
          <div
            data-testid="workspace-user-avatar"
            style={{
              width: '28px',
              height: '28px',
              borderRadius: RADII.full,
              backgroundColor: THEME.default.surfaces.subtle,
              border: `1px solid ${THEME.default.borders.hairline}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              color: THEME.default.text.primary,
              flexShrink: 0,
              userSelect: 'none',
            }}
          >
            {initials}
          </div>

          {!isCollapsed && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
              }}
            >
              <span
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  color: THEME.default.text.primary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.2,
                }}
              >
                {displayName}
              </span>
              <span
                style={{
                  fontSize: '0.6875rem',
                  color: THEME.default.text.muted,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.2,
                }}
              >
                {displayEmail}
              </span>
            </div>
          )}
        </div>

        {/* Caret / Chevron-Up Action Trigger */}
        {!isCollapsed && (
          <button
            type="button"
            aria-label="User menu"
            aria-haspopup="true"
            aria-expanded={isOpen}
            data-testid="workspace-user-caret"
            onClick={() => setIsOpen((prev) => !prev)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '24px',
              height: '24px',
              borderRadius: RADII.xs,
              border: 'none',
              backgroundColor: isOpen ? THEME.default.surfaces.hover : 'transparent',
              color: isOpen ? THEME.default.text.primary : THEME.default.text.muted,
              cursor: 'pointer',
              flexShrink: 0,
              padding: 0,
              transition: 'all 0.12s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = THEME.default.surfaces.hover;
              e.currentTarget.style.color = THEME.default.text.primary;
            }}
            onMouseLeave={(e) => {
              if (!isOpen) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = THEME.default.text.muted;
              }
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 150ms ease',
              }}
              aria-hidden="true"
            >
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
