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
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';
import { WorkspaceStudioFooter } from './workspace-studio-footer';
import { UPCOMING_PLATFORMS, TESTING_PLACEHOLDER_TEXT } from './platform-nav-config';

export interface WorkspaceSidebarProps {
  subdomain: string;
  user?: {
    name: string;
    email: string;
    avatarUrl?: string | undefined;
  } | undefined;
}

export function WorkspaceSidebar({ subdomain, user }: Readonly<WorkspaceSidebarProps>) {
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

  const effectivePath = optimisticPathname ?? (pathname || '');

  const homeHref = `/tenant/${subdomain}`;
  const mediaHref = `/tenant/${subdomain}/media`;
  const downloaderHref = `/tenant/${subdomain}/downloader`;
  const accountsHref = `/tenant/${subdomain}/accounts`;
  const pagesHref = `/tenant/${subdomain}/pages`;

  const isHomeActive = effectivePath === homeHref;
  const isMediaActive = effectivePath.startsWith(mediaHref);
  const isDownloaderActive = effectivePath.startsWith(downloaderHref);
  const isAccountsActive = effectivePath.startsWith(accountsHref);
  const isPagesActive = effectivePath.startsWith(pagesHref);

  const handleNavigate = (href: string) => {
    setOptimisticPathname(href);
    if (isMobile) {
      setOpenMobile(false);
    }
    router.push(href);
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
          onClick={(e) => {
            e.preventDefault();
            handleNavigate(homeHref);
          }}
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
            <svg
              width="20"
              height="20"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M8 22L16 6L24 22H19L16 16L13 22H8Z"
                fill={PALETTE.primary}
              />
              <circle cx="16" cy="11" r="2" fill="#000000" />
            </svg>
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
                  onClick={() => handleNavigate(homeHref)}
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
                  onClick={() => handleNavigate(mediaHref)}
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
                  onClick={() => handleNavigate(downloaderHref)}
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
                          onClick={() => handleNavigate(accountsHref)}
                          onMouseEnter={() => handlePrefetch(accountsHref)}
                        >
                          Accounts
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          isActive={isPagesActive}
                          onClick={() => handleNavigate(pagesHref)}
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
                const platformAccountsHref = `/tenant/${subdomain}/${platform.routeSlug}/accounts`;
                const isPlatformActive = effectivePath.startsWith(`/tenant/${subdomain}/${platform.routeSlug}`);
                const isAccountsSubActive = effectivePath.startsWith(platformAccountsHref);
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
                              onClick={() => handleNavigate(platformAccountsHref)}
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
          user={user}
          onNavigate={handleNavigate}
        />
      </SidebarFooter>

      {/* Interactive Edge Rail */}
      <SidebarRail />
    </Sidebar>
  );
}
