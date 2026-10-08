/**
 * @file status-dot.test.tsx
 * @description Unit and accessibility tests for StatusDot and Tag components (T021 / US4).
 * Enforces strictly unboxed 6px luminous dots with micro-halos (zero capsule pill badges)
 * and rectilinear 4px geometry on tags.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { StatusDot, Tag } from '@/components/ui';
import { PALETTE } from '@/lib/theme';
import { render } from './setup';

describe('Status Signals: StatusDot & Tag (US4 / T021)', () => {
  describe('StatusDot Component', () => {
    it('renders operational state with unboxed 6px Emerald dot and luminous micro-halo', () => {
      const { html, getAttribute, hasText } = render(
        <StatusDot status="operational" />
      );

      expect(hasText('Operational')).toBe(true);
      expect(getAttribute('role')).toBe('status');
      expect(getAttribute('aria-label')).toBe('Status: Operational');

      // Strict 6px geometry and halo
      expect(html).toContain('width:6px');
      expect(html).toContain('height:6px');
      expect(html).toContain(`background-color:${PALETTE.accent4}`);
      expect(html).toContain('box-shadow:0 0 6px rgba(46, 189, 133, 0.45)');
    });

    it('renders queued state with unboxed 6px Gold dot and luminous micro-halo', () => {
      const { html, getAttribute, hasText } = render(
        <StatusDot status="queued" />
      );

      expect(hasText('Queued')).toBe(true);
      expect(getAttribute('aria-label')).toBe('Status: Queued');
      expect(html).toContain('width:6px');
      expect(html).toContain('height:6px');
      expect(html).toContain(`background-color:${PALETTE.primary}`);
      expect(html).toContain('box-shadow:0 0 6px rgba(250, 215, 52, 0.45)');
    });

    it('renders critical state with unboxed 6px Rose dot and luminous micro-halo', () => {
      const { html, getAttribute, hasText } = render(
        <StatusDot status="critical" />
      );

      expect(hasText('Critical')).toBe(true);
      expect(getAttribute('aria-label')).toBe('Status: Critical');
      expect(html).toContain('width:6px');
      expect(html).toContain('height:6px');
      expect(html).toContain(`background-color:${PALETTE.accent3}`);
      expect(html).toContain('box-shadow:0 0 6px rgba(246, 70, 93, 0.45)');
    });

    it('renders idle state with neutral slate tone', () => {
      const { html, getAttribute, hasText } = render(
        <StatusDot status="idle" />
      );

      expect(hasText('Idle')).toBe(true);
      expect(getAttribute('aria-label')).toBe('Status: Idle');
      expect(html).toContain('background-color:#848e9c');
    });

    it('supports custom label while maintaining accessible aria-label', () => {
      const { getAttribute, hasText } = render(
        <StatusDot status="operational" label="Facebook Graph Connected" />
      );

      expect(hasText('Facebook Graph Connected')).toBe(true);
      expect(getAttribute('aria-label')).toBe('Status: Facebook Graph Connected');
    });

    it('hides visible text when showLabel is false but preserves screen-reader announcement', () => {
      const { getAttribute, findTags } = render(
        <StatusDot status="operational" showLabel={false} />
      );

      // Only the outer indicator span and the dot span exist — no visible label span
      const spans = findTags('span');
      expect(spans.length).toBe(2);
      expect(getAttribute('aria-label')).toBe('Status: Operational');
    });

    it('strictly forbids capsule pill borders (no capsule badge container)', () => {
      const { html } = render(<StatusDot status="operational" />);
      // Should not wrap in pill badge with padding and border
      expect(html).not.toContain('border: 1px solid');
      expect(html).not.toContain('badge');
    });
  });

  describe('Tag Component', () => {
    it('enforces strict 4px rectilinear border radius (never capsule)', () => {
      const { html, hasClass, hasText } = render(
        <Tag>POSTED</Tag>
      );

      expect(hasText('POSTED')).toBe(true);
      expect(hasClass('fbu-tag')).toBe(true);
      // Strictly 4px radius
      expect(html).toContain('border-radius:4px');
      expect(html).not.toContain('border-radius:9999px');
    });

    it('renders primary tag variant with subtle gold background and 1px border', () => {
      const { html, hasClass } = render(
        <Tag variant="primary">CRON ACTIVE</Tag>
      );

      expect(hasClass('fbu-tag-primary')).toBe(true);
      expect(html).toContain('background-color:rgba(250, 215, 52, 0.12)');
      expect(html).toContain(`color:${PALETTE.primary}`);
      expect(html).toContain('border:1px solid rgba(250, 215, 52, 0.35)');
    });

    it('renders success tag variant with emerald accent', () => {
      const { html, hasClass } = render(
        <Tag variant="success">HEALTHY</Tag>
      );

      expect(hasClass('fbu-tag-success')).toBe(true);
      expect(html).toContain(`color:${PALETTE.accent4}`);
    });

    it('renders danger tag variant with rose accent', () => {
      const { html, hasClass } = render(
        <Tag variant="danger">RATE LIMITED</Tag>
      );

      expect(hasClass('fbu-tag-danger')).toBe(true);
      expect(html).toContain(`color:${PALETTE.accent3}`);
    });
  });
});
