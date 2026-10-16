'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import { CreateWorkspaceModal } from './create-workspace-modal';

export interface WorkspaceItem {
  id: string;
  name: string;
  subdomain: string;
}

export interface WorkspaceSwitcherProps {
  currentSubdomain: string;
}

function getMonogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || 'WS';
}

export function WorkspaceSwitcher({ currentSubdomain }: Readonly<WorkspaceSwitcherProps>) {
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([
    {
      id: 'current',
      name: currentSubdomain,
      subdomain: currentSubdomain,
    },
  ]);
  const menuRef = useRef<HTMLLIElement>(null);

  // Fetch workspaces list
  useEffect(() => {
    let isMounted = true;
    async function loadWorkspaces() {
      try {
        const res = await fetch('/api/workspaces');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data?.workspaces) && data.workspaces.length > 0) {
            setWorkspaces(data.workspaces);
          }
        }
      } catch {
        // Fallback to active workspace
      }
    }
    void loadWorkspaces();

    const handleWorkspaceUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ subdomain?: string; name?: string }>;
      if (customEvent.detail?.name && customEvent.detail?.subdomain) {
        setWorkspaces((prev) =>
          prev.map((w) =>
            w.subdomain.toLowerCase() === customEvent.detail?.subdomain?.toLowerCase()
              ? { ...w, name: customEvent.detail.name! }
              : w
          )
        );
      }
      void loadWorkspaces();
    };

    window.addEventListener('workspace-updated', handleWorkspaceUpdated);
    return () => {
      isMounted = false;
      window.removeEventListener('workspace-updated', handleWorkspaceUpdated);
    };
  }, [currentSubdomain]);

  // Outside click listener
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const activeWorkspace =
    workspaces.find((w) => w.subdomain.toLowerCase() === currentSubdomain.toLowerCase()) || {
      id: 'active',
      name: currentSubdomain,
      subdomain: currentSubdomain,
    };

  const handleSelectWorkspace = async (targetSubdomain: string) => {
    if (targetSubdomain.toLowerCase() === currentSubdomain.toLowerCase()) {
      setIsOpen(false);
      return;
    }

    setIsSwitching(true);
    setIsOpen(false);
    try {
      const res = await fetch('/api/workspaces/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain: targetSubdomain }),
      });
      if (res.ok) {
        const data = await res.json();
        if (isMobile) setOpenMobile(false);
        if (data.redirectUrl) {
          window.location.href = data.redirectUrl;
        } else {
          window.location.href = `/tenant/${targetSubdomain}`;
        }
        return;
      }
    } catch {
      // Ignore and reset
    }
    setIsSwitching(false);
  };

  const handleOpenSettings = () => {
    setIsOpen(false);
    if (isMobile) setOpenMobile(false);
    router.push(`/tenant/${currentSubdomain}/settings`);
  };

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem ref={menuRef} style={{ position: 'relative' }}>
          {/* Dropdown Popover */}
          {isOpen && (
            <div
              role="menu"
              aria-label="Workspaces"
              data-testid="workspace-switcher-dropdown"
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: SPACING.xs,
                width: '260px',
                backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                borderRadius: RADII.md,
                boxShadow: `var(--shadow-modal, ${THEME.default.shadows.modal})`,
                padding: SPACING.xs,
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              <div
                style={{
                  padding: `${SPACING.xs} ${SPACING.sm}`,
                  fontSize: '0.6875rem',
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  textTransform: 'uppercase',
                  letterSpacing: TYPOGRAPHY.tracking.caption,
                  color: `var(--text-dim, ${THEME.default.text.muted})`,
                }}
              >
                Workspaces
              </div>

              {/* Workspaces List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {workspaces.map((ws) => {
                  const isActive =
                    ws.subdomain.toLowerCase() === currentSubdomain.toLowerCase();
                  return (
                    <button
                      key={ws.id || ws.subdomain}
                      type="button"
                      role="menuitem"
                      data-testid={`workspace-option-${ws.subdomain}`}
                      onClick={() => handleSelectWorkspace(ws.subdomain)}
                      disabled={isSwitching}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: SPACING.sm,
                        width: '100%',
                        padding: `${SPACING.xs} ${SPACING.sm}`,
                        borderRadius: RADII.sm,
                        border: 'none',
                        backgroundColor: isActive
                          ? `var(--bg-active, ${THEME.default.surfaces.active})`
                          : 'transparent',
                        color: `var(--text-main, ${THEME.default.text.primary})`,
                        cursor: isSwitching ? 'not-allowed' : 'pointer',
                        textAlign: 'left',
                        outline: 'none',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = `var(--bg-hover, ${THEME.default.surfaces.hover})`;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: RADII.xs,
                          backgroundColor: isActive ? PALETTE.primary : `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
                          color: isActive ? PALETTE.background : `var(--text-sub, ${THEME.default.text.secondary})`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: TYPOGRAPHY.weights.bold,
                          fontSize: '0.6875rem',
                          flexShrink: 0,
                        }}
                      >
                        {getMonogram(ws.name)}
                      </div>

                      <div style={{ flex: 1, minWidth: 0, display: 'grid' }}>
                        <span
                          style={{
                            fontSize: '0.8125rem',
                            fontWeight: isActive
                              ? TYPOGRAPHY.weights.semibold
                              : TYPOGRAPHY.weights.medium,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {ws.name}
                        </span>
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            color: `var(--text-dim, ${THEME.default.text.muted})`,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {ws.subdomain}
                        </span>
                      </div>

                      {isActive && (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={PALETTE.primary}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                          style={{ flexShrink: 0, marginLeft: 'auto' }}
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Separator */}
              <div
                style={{
                  height: '1px',
                  backgroundColor: `var(--border-subtle, ${THEME.default.borders.hairline})`,
                  margin: `${SPACING.xs} 0`,
                }}
              />

              {/* Create Workspace Action */}
              <button
                type="button"
                role="menuitem"
                data-testid="workspace-switcher-create-btn"
                onClick={() => {
                  setIsOpen(false);
                  setIsCreateOpen(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: SPACING.sm,
                  width: '100%',
                  padding: `${SPACING.xs} ${SPACING.sm}`,
                  borderRadius: RADII.sm,
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: `var(--text-sub, ${THEME.default.text.secondary})`,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.15s ease, color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = `var(--bg-hover, ${THEME.default.surfaces.hover})`;
                  e.currentTarget.style.color = PALETTE.primary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
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
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>Create Workspace</span>
              </button>

              {/* Workspace Settings Link */}
              <button
                type="button"
                role="menuitem"
                data-testid="workspace-switcher-settings-btn"
                onClick={handleOpenSettings}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: SPACING.sm,
                  width: '100%',
                  padding: `${SPACING.xs} ${SPACING.sm}`,
                  borderRadius: RADII.sm,
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: `var(--text-sub, ${THEME.default.text.secondary})`,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.15s ease, color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = `var(--bg-hover, ${THEME.default.surfaces.hover})`;
                  e.currentTarget.style.color = PALETTE.primary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
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
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                <span>Workspace Settings</span>
              </button>
            </div>
          )}

          {/* Trigger Button (Shadcn TeamSwitcher SidebarMenuButton size="lg") */}
          <SidebarMenuButton
            size="lg"
            tooltip={`${activeWorkspace.name} (${activeWorkspace.subdomain})`}
            data-testid="workspace-switcher-trigger"
            aria-haspopup="true"
            aria-expanded={isOpen}
            isActive={isOpen}
            onClick={() => setIsOpen((prev) => !prev)}
          >
            <div
              data-sidebar-icon="true"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: RADII.md,
                backgroundColor: PALETTE.primary,
                color: PALETTE.background,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: TYPOGRAPHY.weights.bold,
                fontSize: '0.8125rem',
                flexShrink: 0,
                userSelect: 'none',
              }}
            >
              {getMonogram(activeWorkspace.name)}
            </div>

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
                  textTransform: 'capitalize',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {activeWorkspace.name}
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
                {activeWorkspace.subdomain}
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

      {/* Creation Modal */}
      <CreateWorkspaceModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={(created) => {
          setWorkspaces((prev) => [...prev, created]);
        }}
      />
    </>
  );
}
