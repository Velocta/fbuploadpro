/**
 * @file sidebar.test.tsx
 * @description Unit and theme compliance tests for Shared Sidebar Component (Spec 014 / US1, US2, US3).
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarInset,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarRail,
  SidebarTrigger,
  SidebarSeparator,
  SIDEBAR_COOKIE_NAME,
  SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_ICON,
  SIDEBAR_KEYBOARD_SHORTCUT,
} from '@/components/ui';
import { PALETTE, THEME, RADII } from '@/lib/theme';
import { render } from '../components/setup';

describe('Sidebar Component Suite (Spec 014)', () => {
  describe('Constants & Configuration', () => {
    it('defines standard cookie name, widths, and keyboard shortcut', () => {
      expect(SIDEBAR_COOKIE_NAME).toBe('sidebar_state');
      expect(SIDEBAR_WIDTH).toBe('256px');
      expect(SIDEBAR_WIDTH_ICON).toBe('48px');
      expect(SIDEBAR_KEYBOARD_SHORTCUT).toBe('b');
    });
  });

  describe('Structural Primitives & Layout', () => {
    it('renders SidebarProvider with full layout container', () => {
      const { hasTag, hasText } = render(
        <SidebarProvider>
          <div>Workspace Content</div>
        </SidebarProvider>
      );

      expect(hasTag('div')).toBe(true);
      expect(hasText('Workspace Content')).toBe(true);
    });

    it('renders Sidebar shell with navigation role and ARIA labels', () => {
      const { hasTag, hasAttribute } = render(
        <SidebarProvider>
          <Sidebar>
            <div>Nav Elements</div>
          </Sidebar>
        </SidebarProvider>
      );

      expect(hasTag('aside')).toBe(true);
      expect(hasAttribute('role', 'navigation')).toBe(true);
      expect(hasAttribute('aria-label', 'Sidebar Navigation')).toBe(true);
      expect(hasAttribute('data-state', 'expanded')).toBe(true);
      expect(hasAttribute('data-collapsible', 'icon')).toBe(true);
    });

    it('renders SidebarHeader, SidebarContent, SidebarFooter, and SidebarInset', () => {
      const { hasTag, hasText } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarHeader>Header Section</SidebarHeader>
            <SidebarContent>Content Section</SidebarContent>
            <SidebarFooter>Footer Section</SidebarFooter>
          </Sidebar>
          <SidebarInset>Main Canvas</SidebarInset>
        </SidebarProvider>
      );

      expect(hasTag('header')).toBe(true);
      expect(hasText('Header Section')).toBe(true);
      expect(hasText('Content Section')).toBe(true);
      expect(hasTag('footer')).toBe(true);
      expect(hasText('Footer Section')).toBe(true);
      expect(hasTag('main')).toBe(true);
      expect(hasText('Main Canvas')).toBe(true);
    });
  });

  describe('Group & Menu Primitives', () => {
    it('renders SidebarGroup, SidebarGroupLabel, and SidebarGroupAction', () => {
      const { hasAttribute, hasText, hasTag } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>
                  Publishing
                  <SidebarGroupAction aria-label="Add Campaign">+</SidebarGroupAction>
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <div>Group Items</div>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      );

      expect(hasAttribute('role', 'group')).toBe(true);
      expect(hasText('Publishing')).toBe(true);
      expect(hasTag('button')).toBe(true);
      expect(hasText('+')).toBe(true);
      expect(hasText('Group Items')).toBe(true);
    });

    it('renders SidebarMenu and SidebarMenuItem with role attributes', () => {
      const { hasAttribute, hasText } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton>Dashboard</SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      );

      expect(hasAttribute('role', 'menu')).toBe(true);
      expect(hasAttribute('role', 'menuitem')).toBe(true);
      expect(hasText('Dashboard')).toBe(true);
    });

    it('renders active SidebarMenuButton with gold indicator and primary text', () => {
      const { html, hasAttribute } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive>Active Route</SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      );

      expect(hasAttribute('aria-current', 'page')).toBe(true);
      // Gold primary indicator (#fad734) active bar rendered
      expect(html).toContain(PALETTE.primary);
      expect(html).toContain(THEME.default.surfaces.active);
    });

    it('renders SidebarMenuBadge with crisp non-pill radius and hairline border', () => {
      const { hasText, hasStyle } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    Queue
                    <SidebarMenuBadge>12</SidebarMenuBadge>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      );

      expect(hasText('12')).toBe(true);
      // Ensure strictly NOT a capsule pill badge (radius is xs 4px, not full 9999px)
      expect(hasStyle('border-radius', RADII.xs)).toBe(true);
    });

    it('renders nested SidebarMenuSub, SubItem, and SubButton', () => {
      const { hasAttribute, hasText } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton>Facebook Pages</SidebarMenuButton>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton isActive>Page Overview</SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton>Connected Tokens</SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      );

      expect(hasText('Facebook Pages')).toBe(true);
      expect(hasText('Page Overview')).toBe(true);
      expect(hasText('Connected Tokens')).toBe(true);
      expect(hasAttribute('role', 'menu')).toBe(true);
    });
  });

  describe('Rail & Trigger Controls', () => {
    it('renders SidebarTrigger with accessible icon and aria-label', () => {
      const { hasAttribute, hasTag } = render(
        <SidebarProvider>
          <SidebarTrigger />
        </SidebarProvider>
      );

      expect(hasTag('button')).toBe(true);
      expect(hasAttribute('aria-label', 'Toggle Sidebar')).toBe(true);
      expect(hasAttribute('aria-expanded', 'true')).toBe(true);
      expect(hasTag('svg')).toBe(true);
    });

    it('renders SidebarRail on sidebar edge', () => {
      const { hasAttribute, hasTag } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarRail />
          </Sidebar>
        </SidebarProvider>
      );

      expect(hasTag('button')).toBe(true);
      expect(hasAttribute('aria-label', 'Toggle Sidebar Rail')).toBe(true);
    });

    it('renders SidebarSeparator with data-sidebar="separator" attribute', () => {
      const { hasTag, hasAttribute, html } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarSeparator />
          </Sidebar>
        </SidebarProvider>
      );

      expect(hasTag('div')).toBe(true);
      expect(hasAttribute('data-sidebar', 'separator')).toBe(true);
      expect(html).toContain(THEME.default.borders.hairline);
    });
  });

  describe('Theme Token Authority Compliance', () => {
    it('uses canonical panel surfaces and hairline borders without ad-hoc colors', () => {
      const { html } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarHeader>Header</SidebarHeader>
            <SidebarContent>Content</SidebarContent>
            <SidebarFooter>Footer</SidebarFooter>
          </Sidebar>
        </SidebarProvider>
      );

      // Uses pitch-black panel surface (#0c0d10)
      expect(html).toContain(THEME.default.surfaces.panel);
      // Uses 1px hairline border (#1f242d)
      expect(html).toContain(THEME.default.borders.hairline);
    });
  });
});
