'use client';

import React from 'react';
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
  SidebarSeparator,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';
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
      {/* Workspace Identity Header */}
      <SidebarHeader>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: isCollapsed ? 0 : SPACING.sm,
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            minHeight: '36px',
            width: '100%',
          }}
        >
          {/* Brand Monogram Icon */}
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: RADII.sm,
              backgroundColor: PALETTE.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: PALETTE.background,
              fontWeight: TYPOGRAPHY.weights.bold,
              fontSize: '0.875rem',
              flexShrink: 0,
              boxShadow: '0 0 12px rgba(240, 185, 11, 0.25)',
              userSelect: 'none',
            }}
          >
            FB
          </div>

          {!isCollapsed && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
                overflow: 'hidden',
              }}
            >
              <span
                style={{
                  fontSize: '0.875rem',
                  fontWeight: TYPOGRAPHY.weights.bold,
                  letterSpacing: TYPOGRAPHY.tracking.h3,
                  color: THEME.default.text.primary,
                  textTransform: 'capitalize',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.2,
                }}
              >
                {subdomain}
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
                FBUploadPro
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      {/* Primary Navigation Content */}
      <SidebarContent>
        {/* Home Item */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={isHomeActive}
              tooltip="Home"
              onClick={() => handleNavigate(homeHref)}
              leftIcon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              }
            >
              Home
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Separator Line Between Home & Facebook */}
        <SidebarSeparator />

        {/* Facebook Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Facebook</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isAccountsActive}
                  tooltip="Accounts"
                  onClick={() => handleNavigate(accountsHref)}
                  leftIcon={
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  }
                >
                  Accounts
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* User Menu Footer */}
      <SidebarFooter>
        <WorkspaceUserMenu user={user} />
      </SidebarFooter>

      {/* Rail Resizer & Toggle */}
      <SidebarRail />
    </Sidebar>
  );
}
