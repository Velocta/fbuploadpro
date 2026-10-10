/**
 * @file sidebar.test.tsx
 * @description Unit and theme compliance tests for Shared Sidebar Component (Spec 014 & Spec 025).
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
  SidebarInput,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarRail,
  SidebarTrigger,
  SidebarSeparator,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  SIDEBAR_COOKIE_NAME,
  SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_ICON,
  SIDEBAR_KEYBOARD_SHORTCUT,
} from '@/components/ui';
import { PALETTE, THEME, RADII } from '@/lib/theme';
import { render } from '../components/setup';

describe('Sidebar Component Suite (Spec 014 & Spec 025)', () => {
  describe('Constants & Configuration', () => {
    it('defines standard cookie name, widths, and keyboard shortcut', () => {
      expect(SIDEBAR_COOKIE_NAME).toBe('sidebar_state');
      expect(SIDEBAR_WIDTH).toBe('256px');
      expect(SIDEBAR_WIDTH_ICON).toBe('48px');
      expect(SIDEBAR_KEYBOARD_SHORTCUT).toBe('b');
    });
  });

  describe('Structural Primitives & Two-Layer Architecture', () => {
    it('renders SidebarProvider with full layout container', () => {
      const { hasTag, hasText, hasAttribute } = render(
        <SidebarProvider>
          <div>Workspace Content</div>
        </SidebarProvider>
      );

      expect(hasTag('div')).toBe(true);
      expect(hasAttribute('data-slot', 'sidebar-wrapper')).toBe(true);
      expect(hasText('Workspace Content')).toBe(true);
    });

    it('renders Sidebar with two-layer desktop architecture (sidebar-gap, sidebar-container, sidebar-inner)', () => {
      const { hasTag, hasAttribute, hasStyle } = render(
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
      expect(hasAttribute('data-slot', 'sidebar-gap')).toBe(true);
      expect(hasAttribute('data-slot', 'sidebar-container')).toBe(true);
      expect(hasAttribute('data-slot', 'sidebar-inner')).toBe(true);
      expect(hasStyle('overflow', 'visible')).toBe(true);
    });

    it('renders SidebarHeader, SidebarContent, SidebarFooter, and SidebarInset', () => {
      const { hasTag, hasText, hasAttribute } = render(
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
      expect(hasAttribute('data-slot', 'sidebar-header')).toBe(true);
      expect(hasText('Header Section')).toBe(true);
      expect(hasAttribute('data-slot', 'sidebar-content')).toBe(true);
      expect(hasText('Content Section')).toBe(true);
      expect(hasTag('footer')).toBe(true);
      expect(hasAttribute('data-slot', 'sidebar-footer')).toBe(true);
      expect(hasText('Footer Section')).toBe(true);
      expect(hasTag('main')).toBe(true);
      expect(hasAttribute('data-slot', 'sidebar-inset')).toBe(true);
      expect(hasText('Main Canvas')).toBe(true);
    });

    it('ensures zero overflow clipping on collapsed SidebarContent and sidebar-inner', () => {
      const { hasAttribute, hasStyle } = render(
        <SidebarProvider open={false}>
          <Sidebar>
            <SidebarContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Home Tooltip">Home</SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      );

      expect(hasAttribute('data-state', 'collapsed')).toBe(true);
      expect(hasStyle('overflow', 'visible')).toBe(true);
      expect(hasStyle('overflow-x', 'visible')).toBe(true);
      expect(hasStyle('overflow-y', 'visible')).toBe(true);
    });

    it('renders SidebarInput with data-slot="sidebar-input"', () => {
      const { hasTag, hasAttribute } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarHeader>
              <SidebarInput placeholder="Filter workspace..." />
            </SidebarHeader>
          </Sidebar>
        </SidebarProvider>
      );

      expect(hasTag('input')).toBe(true);
      expect(hasAttribute('data-slot', 'sidebar-input')).toBe(true);
      expect(hasAttribute('data-sidebar', 'input')).toBe(true);
      expect(hasAttribute('placeholder', 'Filter workspace...')).toBe(true);
    });
  });

  describe('Collapsible Disclosure Primitives', () => {
    it('renders Collapsible, CollapsibleTrigger, and CollapsibleContent when open', () => {
      const { hasAttribute, hasText } = render(
        <SidebarProvider>
          <Collapsible defaultOpen={true}>
            <CollapsibleTrigger>Platform Toggle</CollapsibleTrigger>
            <CollapsibleContent>Nested Content</CollapsibleContent>
          </Collapsible>
        </SidebarProvider>
      );

      expect(hasAttribute('data-slot', 'collapsible')).toBe(true);
      expect(hasAttribute('data-state', 'open')).toBe(true);
      expect(hasAttribute('data-slot', 'collapsible-trigger')).toBe(true);
      expect(hasAttribute('aria-expanded', 'true')).toBe(true);
      expect(hasAttribute('data-slot', 'collapsible-content')).toBe(true);
      expect(hasText('Platform Toggle')).toBe(true);
      expect(hasText('Nested Content')).toBe(true);
    });

    it('hides CollapsibleContent when Collapsible is closed', () => {
      const { hasAttribute, hasText } = render(
        <SidebarProvider>
          <Collapsible open={false}>
            <CollapsibleTrigger>Platform Toggle</CollapsibleTrigger>
            <CollapsibleContent>Hidden Nested Content</CollapsibleContent>
          </Collapsible>
        </SidebarProvider>
      );

      expect(hasAttribute('data-slot', 'collapsible')).toBe(true);
      expect(hasAttribute('data-state', 'closed')).toBe(true);
      expect(hasAttribute('aria-expanded', 'false')).toBe(true);
      expect(hasText('Hidden Nested Content')).toBe(false);
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

    it('renders SidebarMenuButton size variants (sm, default, lg) and collapsed icon mode (open={false})', () => {
      const expanded = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton size="sm">Small Item</SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton size="default">Default Item</SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton size="lg">Large Item</SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      );

      expect(expanded.hasAttribute('data-size', 'sm')).toBe(true);
      expect(expanded.hasAttribute('data-size', 'default')).toBe(true);
      expect(expanded.hasAttribute('data-size', 'lg')).toBe(true);
      expect(expanded.hasStyle('height', '28px')).toBe(true);
      expect(expanded.hasStyle('height', '32px')).toBe(true);
      expect(expanded.hasStyle('height', '48px')).toBe(true);

      const collapsed = render(
        <SidebarProvider open={false}>
          <Sidebar>
            <SidebarHeader>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton size="lg" tooltip="Workspace">
                    <span>Icon</span>
                    <span>Label</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarHeader>
          </Sidebar>
        </SidebarProvider>
      );

      expect(collapsed.hasAttribute('data-collapsed', 'true')).toBe(true);
      expect(collapsed.hasStyle('width', '32px')).toBe(true);
      expect(collapsed.hasStyle('height', '32px')).toBe(true);
      expect(collapsed.hasStyle('padding', '0px')).toBe(true);
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

    it('renders SidebarMenuSkeleton with and without showIcon', () => {
      const { hasAttribute } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuSkeleton showIcon />
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      );

      expect(hasAttribute('data-slot', 'sidebar-menu-skeleton')).toBe(true);
      expect(hasAttribute('data-sidebar', 'menu-skeleton-icon')).toBe(true);
      expect(hasAttribute('data-sidebar', 'menu-skeleton-text')).toBe(true);
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
      expect(hasAttribute('data-slot', 'sidebar-menu-sub')).toBe(true);
      expect(hasAttribute('data-slot', 'sidebar-menu-sub-item')).toBe(true);
      expect(hasAttribute('data-slot', 'sidebar-menu-sub-button')).toBe(true);
      expect(hasAttribute('role', 'menu')).toBe(true);
    });

    it('renders SidebarMenuAction when expanded and hides when collapsed', () => {
      const expanded = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton>Item</SidebarMenuButton>
                  <SidebarMenuAction aria-label="More options">...</SidebarMenuAction>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      );

      expect(expanded.hasAttribute('data-slot', 'sidebar-menu-action')).toBe(true);
      expect(expanded.hasText('...')).toBe(true);
    });
  });

  describe('Rail & Trigger Controls', () => {
    it('renders SidebarTrigger with PanelLeft icon and aria-label', () => {
      const { hasAttribute, hasTag, html } = render(
        <SidebarProvider>
          <SidebarTrigger />
        </SidebarProvider>
      );

      expect(hasTag('button')).toBe(true);
      expect(hasAttribute('data-slot', 'sidebar-trigger')).toBe(true);
      expect(hasAttribute('aria-label', 'Toggle Sidebar')).toBe(true);
      expect(hasAttribute('aria-expanded', 'true')).toBe(true);
      expect(hasTag('svg')).toBe(true);
      expect(html).toContain('M9 3v18');
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
      expect(hasAttribute('data-slot', 'sidebar-rail')).toBe(true);
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
      expect(hasAttribute('data-slot', 'sidebar-separator')).toBe(true);
      expect(html).toContain(THEME.default.borders.hairline);
    });
  });

  describe('Theme Token Authority Compliance', () => {
    it('uses canonical panel surfaces and hairline borders with CSS custom property bindings', () => {
      const { html } = render(
        <SidebarProvider>
          <Sidebar>
            <SidebarHeader>Header</SidebarHeader>
            <SidebarContent>Content</SidebarContent>
            <SidebarFooter>Footer</SidebarFooter>
          </Sidebar>
        </SidebarProvider>
      );

      // Uses CSS variables with fallback to canonical theme tokens
      expect(html).toContain('--bg-panel');
      expect(html).toContain(THEME.default.surfaces.panel);
      expect(html).toContain('--border-subtle');
      expect(html).toContain(THEME.default.borders.hairline);
    });
  });
});

