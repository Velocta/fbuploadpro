'use client';

import React, { useState } from 'react';
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
import { THEME, SPACING, TYPOGRAPHY } from '@/lib/theme';
import { WorkspaceUserMenu } from './workspace-user-menu';
import { WorkspaceSwitcher } from './workspace-switcher';
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

  const homeHref = `/tenant/${subdomain}`;
  const mediaHref = `/tenant/${subdomain}/media`;
  const downloaderHref = `/tenant/${subdomain}/downloader`;
  const accountsHref = `/tenant/${subdomain}/accounts`;
  const pagesHref = `/tenant/${subdomain}/pages`;
  const settingsHref = `/tenant/${subdomain}/settings`;

  const isHomeActive = pathname === homeHref;
  const isMediaActive = pathname ? pathname.startsWith(mediaHref) : false;
  const isDownloaderActive = pathname ? pathname.startsWith(downloaderHref) : false;
  const isAccountsActive = pathname ? pathname.startsWith(accountsHref) : false;
  const isPagesActive = pathname ? pathname.startsWith(pagesHref) : false;
  const isSettingsActive = pathname ? pathname.startsWith(settingsHref) : false;

  const handleNavigate = (href: string) => {
    if (isMobile) {
      setOpenMobile(false);
    }
    router.push(href);
  };

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      {/* Workspace Identity Header (Shadcn TeamSwitcher Pattern) */}
      <SidebarHeader>
        <WorkspaceSwitcher currentSubdomain={subdomain} />
      </SidebarHeader>

      {/* Primary Navigation Content */}
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

        {/* Collapsible Facebook -> Accounts Hierarchy (Shadcn NavMain Pattern) */}
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
                        >
                          Accounts
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          isActive={isPagesActive}
                          onClick={() => handleNavigate(pagesHref)}
                        >
                          Pages
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {/* Upcoming Supported Platforms (Being Tested) */}
              {UPCOMING_PLATFORMS.map((platform) => {
                const platformAccountsHref = `/tenant/${subdomain}/${platform.routeSlug}/accounts`;
                const isPlatformActive = pathname ? pathname.startsWith(`/tenant/${subdomain}/${platform.routeSlug}`) : false;
                const isAccountsSubActive = pathname ? pathname.startsWith(platformAccountsHref) : false;
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


        {/* Separator Line */}
        <SidebarSeparator />

        {/* Configuration Group (Settings) */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isSettingsActive}
                  tooltip="Settings"
                  onClick={() => handleNavigate(settingsHref)}
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
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                  }
                >
                  Settings
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* User Menu Footer (Shadcn NavUser Pattern) */}
      <SidebarFooter>
        <WorkspaceUserMenu user={user} subdomain={subdomain} />
      </SidebarFooter>

      {/* Interactive Edge Rail */}
      <SidebarRail />
    </Sidebar>
  );
}
