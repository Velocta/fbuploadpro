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
import { THEME, PALETTE, RADII, TYPOGRAPHY } from '@/lib/theme';
import { WorkspaceUserMenu } from './workspace-user-menu';

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

  const homeHref = `/tenant/${subdomain}`;
  const accountsHref = `/tenant/${subdomain}/accounts`;

  const isHomeActive = pathname === homeHref;
  const isAccountsActive = pathname ? pathname.startsWith(accountsHref) : false;

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
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip={`${subdomain} — FBUploadPro`}
              onClick={() => handleNavigate(homeHref)}
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
                FB
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
                  {subdomain}
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
                  FBUploadPro
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
      </SidebarHeader>

      {/* Primary Navigation Content */}
      <SidebarContent>
        {/* Top Home Navigation Group */}
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Separator Line Between Home & Platform */}
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
                      tooltip="Facebook — Accounts"
                      isActive={isCollapsed && isAccountsActive}
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
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* User Menu Footer (Shadcn NavUser Pattern) */}
      <SidebarFooter>
        <WorkspaceUserMenu user={user} />
      </SidebarFooter>

      {/* Interactive Edge Rail */}
      <SidebarRail />
    </Sidebar>
  );
}
