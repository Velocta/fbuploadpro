/**
 * @file mobile-nav-trigger.test.tsx
 * @description Unit tests for MobileNavTrigger component (Spec 019 / US4).
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { SidebarProvider } from '@/components/ui';
import { MobileNavTrigger } from '@/components/workspace/mobile-nav-trigger';
import { render } from '../components/setup';

describe('MobileNavTrigger Component (Spec 019)', () => {
  it('renders floating button with mobile-only responsive class and accessible ARIA attributes', () => {
    const { hasAttribute, hasTag, hasClass } = render(
      <SidebarProvider>
        <MobileNavTrigger />
      </SidebarProvider>
    );

    expect(hasTag('button')).toBe(true);
    expect(hasAttribute('data-testid', 'mobile-nav-trigger')).toBe(true);
    expect(hasAttribute('aria-label', 'Open navigation menu')).toBe(true);
    expect(hasClass('mobile-only')).toBe(true);
  });
});
