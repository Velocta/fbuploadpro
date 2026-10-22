'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarSeparator,
  SidebarRail,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  useSidebar,
} from '@/components/ui/sidebar';
import { THEME, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';
import { BrandMark } from '@/components/brand';
import { buildTenantHref, normalizeTenantPath } from '@/lib/tenant-href';
import { WorkspaceStudioFooter } from './workspace-studio-footer';
import { UPCOMING_PLATFORMS, TESTING_PLACEHOLDER_TEXT } from './platform-nav-config';

export interface WorkspaceSidebarProps {
  subdomain: string;
  /** True when on the tenant's own subdomain: use clean paths (/accounts). */
  useCleanPaths?: boolean | undefined;
  /** Server-resolved display name — avoids flashing the internal slug. */
  workspaceName?: string | undefined;
  user?: {
    name: string;
    email: string;
    avatarUrl?: string | undefined;
  } | undefined;
}

export function WorkspaceSidebar({ subdomain, useCleanPaths = false, workspaceName, user }: Readonly<WorkspaceSidebarProps>) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const isCollapsed = !isMobile && state === 'collapsed';
  const [isFacebookOpen, setIsFacebookOpen] = useState(true);
  const [openPlatforms, setOpenPlatforms] = useState<Record<string, boolean>>({});
  const [optimisticPathname, setOptimisticPathname] = useState<string | null>(null);

  useEffect(() => {
    setOptimisticPathname(null);
  }, [pathname]);

  const effectivePath = normalizeTenantPath(optimisticPathname ?? (pathname || ''), subdomain);

  const href = (path: string) => buildTenantHref(subdomain, path, useCleanPaths);
  const homeHref = href('/');
  const mediaHref = href('/media');
  const downloaderHref = href('/downloader');
  const fdolaStudioHref = href('/fdola-studio');
  const accountsHref = href('/accounts');
  const pagesHref = href('/pages');

  const isHomeActive = effectivePath === normalizeTenantPath(homeHref, subdomain);
  const isMediaActive = effectivePath.startsWith(normalizeTenantPath(mediaHref, subdomain));
  const isDownloaderActive = effectivePath.startsWith(normalizeTenantPath(downloaderHref, subdomain));
  const isFdolaStudioActive = effectivePath.startsWith(normalizeTenantPath(fdolaStudioHref, subdomain));
  const isAccountsActive = effectivePath.startsWith(normalizeTenantPath(accountsHref, subdomain));
  const isPagesActive = effectivePath.startsWith(normalizeTenantPath(pagesHref, subdomain));

  const handleNavigate = (href: string) => {
    setOptimisticPathname(href);
    if (isMobile) {
      setOpenMobile(false);
    }
    router.push(href);
  };

  /**
   * Click observer for leaf items, which render as real anchors (spec 110).
   * The anchor's native default action performs the navigation, so this
   * handler must never preventDefault or substitute its own router.push —
   * it only paints the active state immediately and closes the mobile
   * drawer. Previously every leaf was a <button> whose sole navigation
   * path was handleNavigate above: the optimistic setState painted the
   * highlight first and navigation depended entirely on the imperative
   * router.push that followed it, so a delayed/interrupted push left the
   * item highlighted without navigating (QA #5 / audit M2).
   */
  const handleLeafClick = (href: string) => {
    setOptimisticPathname(href);
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handlePrefetch = (href: string) => {
    try {
      router.prefetch(href);
    } catch {
      // Ignore prefetch errors
    }
  };

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      {/* Top Section: Official FBUploadPro Logo & Branding */}
      <SidebarHeader>
        <Link
          href={homeHref}
          onClick={() => handleLeafClick(homeHref)}
          onMouseEnter={() => handlePrefetch(homeHref)}
          data-slot="sidebar-header-branding"
          data-testid="sidebar-branding-link"
          aria-label="FBUploadPro Studio"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACING.sm,
            padding: isCollapsed ? '6px 0' : `${SPACING.xs} ${SPACING.sm}`,
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            textDecoration: 'none',
            borderRadius: RADII.md,
            transition: 'background-color 0.15s ease',
            outline: 'none',
          }}
        >
          {/* Geometric Gold Brand Mark */}
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: RADII.sm,
              backgroundColor: '#12141a',
              border: '1px solid #1f242d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <BrandMark size={20} />
          </div>

          {/* Logotype & Studio Subtitle */}
          {!isCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span
                style={{
                  fontSize: '0.9375rem',
                  fontWeight: TYPOGRAPHY.weights.bold,
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                  letterSpacing: TYPOGRAPHY.tracking.caption,
                  lineHeight: 1.2,
                }}
              >
                FBUploadPro
              </span>
              <span
                style={{
                  fontSize: '0.6875rem',
                  color: `var(--text-dim, ${THEME.default.text.muted})`,
                  lineHeight: 1.2,
                }}
              >
                Studio
              </span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      {/* Primary Navigation Content (Order Strictly Preserved) */}
      <SidebarContent>
        {/* Top Primary Navigation Group (Home, Media Library & Downloader) */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isHomeActive}
                  tooltip="Home"
                  href={homeHref}
                  onClick={() => handleLeafClick(homeHref)}
                  onMouseEnter={() => handlePrefetch(homeHref)}
                  leftIcon={
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
                    >
                      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                  }
                >
                  Home
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isMediaActive}
                  tooltip="Media Library"
                  href={mediaHref}
                  onClick={() => handleLeafClick(mediaHref)}
                  onMouseEnter={() => handlePrefetch(mediaHref)}
                  leftIcon={
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
                    >
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      <polygon points="10 11 16 14 10 17 10 11" />
                    </svg>
                  }
                >
                  Media Library
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isDownloaderActive}
                  tooltip="Downloader"
                  href={downloaderHref}
                  onClick={() => handleLeafClick(downloaderHref)}
                  onMouseEnter={() => handlePrefetch(downloaderHref)}
                  leftIcon={
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
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" x2="12" y1="15" y2="3" />
                    </svg>
                  }
                >
                  Downloader
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isFdolaStudioActive}
                  tooltip="Fdola Studio"
                  href={fdolaStudioHref}
                  onClick={() => handleLeafClick(fdolaStudioHref)}
                  onMouseEnter={() => handlePrefetch(fdolaStudioHref)}
                  leftIcon={
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
                    >
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <line x1="8" x2="16" y1="21" y2="21" />
                      <line x1="12" x2="12" y1="17" y2="21" />
                    </svg>
                  }
                >
                  Fdola Studio
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Separator Line Between Primary Navigation & Platform */}
        <SidebarSeparator />

        {/* Collapsible Facebook -> Accounts Hierarchy */}
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible
                open={isFacebookOpen}
                onOpenChange={setIsFacebookOpen}
                defaultOpen={true}
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      tooltip="Facebook — Accounts & Pages"
                      isActive={isCollapsed && (isAccountsActive || isPagesActive)}
                      onClick={() => {
                        if (isCollapsed) {
                          handleNavigate(accountsHref);
                        }
                      }}
                      onMouseEnter={() => handlePrefetch(accountsHref)}
                    >
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
                        style={{ flexShrink: 0 }}
                      >
                        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                      </svg>
                      <span
                        style={{
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Facebook
                      </span>
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
                          transform: isFacebookOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                          transition: 'transform 200ms ease',
                          color: `var(--text-dim, ${THEME.default.text.muted})`,
                        }}
                      >
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </SidebarMenuButton>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          isActive={isAccountsActive}
                          href={accountsHref}
                          onClick={() => handleLeafClick(accountsHref)}
                          onMouseEnter={() => handlePrefetch(accountsHref)}
                        >
                          Accounts
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          isActive={isPagesActive}
                          href={pagesHref}
                          onClick={() => handleLeafClick(pagesHref)}
                          onMouseEnter={() => handlePrefetch(pagesHref)}
                        >
                          Pages
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {/* Upcoming Supported Platforms */}
              {UPCOMING_PLATFORMS.map((platform) => {
                const platformAccountsHref = href(`/${platform.routeSlug}/accounts`);
                const isPlatformActive = effectivePath.startsWith(`/${platform.routeSlug}`);
                const isAccountsSubActive = effectivePath.startsWith(normalizeTenantPath(platformAccountsHref, subdomain));
                const isOpen = openPlatforms[platform.key] ?? (isPlatformActive ? true : false);

                return (
                  <Collapsible
                    key={platform.key}
                    open={isOpen}
                    onOpenChange={(open) =>
                      setOpenPlatforms((prev) => ({ ...prev, [platform.key]: open }))
                    }
                    defaultOpen={false}
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          tooltip={platform.tooltip}
                          isActive={isCollapsed && isPlatformActive}
                          onClick={() => {
                            if (isCollapsed) {
                              handleNavigate(platformAccountsHref);
                            }
                          }}
                          onMouseEnter={() => handlePrefetch(platformAccountsHref)}
                        >
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {platform.icon}
                          </span>
                          <span
                            style={{
                              flex: 1,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {platform.label}
                          </span>
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
                              transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                              transition: 'transform 200ms ease',
                              color: `var(--text-dim, ${THEME.default.text.muted})`,
                            }}
                          >
                            <path d="m9 18 6-6-6-6" />
                          </svg>
                        </SidebarMenuButton>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <SidebarMenuSub>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton
                              isActive={isAccountsSubActive}
                              href={platformAccountsHref}
                              onClick={() => handleLeafClick(platformAccountsHref)}
                              onMouseEnter={() => handlePrefetch(platformAccountsHref)}
                            >
                              Accounts
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                          <SidebarMenuSubItem>
                            <div
                              data-testid={`sidebar-testing-note-${platform.key}`}
                              style={{
                                padding: `${SPACING.xs} ${SPACING.sm}`,
                                fontSize: '0.6875rem',
                                lineHeight: 1.35,
                                color: `var(--text-dim, ${THEME.default.text.muted})`,
                                letterSpacing: TYPOGRAPHY.tracking.body,
                                userSelect: 'none',
                              }}
                            >
                              {TESTING_PLACEHOLDER_TEXT}
                            </div>
                          </SidebarMenuSubItem>
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Option A Unified Studio Footer (Workspace + Settings + User) */}
      <SidebarFooter>
        <WorkspaceStudioFooter
          subdomain={subdomain}
          useCleanPaths={useCleanPaths}
          user={user}
          workspaceName={workspaceName}
          onNavigate={handleNavigate}
        />
      </SidebarFooter>

      {/* Interactive Edge Rail */}
      <SidebarRail />
    </Sidebar>
  );
}
