/**
 * @file form-controls.test.tsx
 * @description Unit and accessibility tests for Checkbox, Switch, and Select (T007 / US1).
 * Tests Checkbox role, aria-checked, rectilinear 4px radius; Switch role, aria-checked;
 * and Select options, placeholder, disabled, and custom chevron.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { Checkbox, Switch, Select } from '@/components/ui';
import { PALETTE } from '@/lib/theme';
import { render } from './setup';

describe('Form Controls: Checkbox, Switch, Select (US1 / T007)', () => {
  describe('Checkbox Component', () => {
    it('renders with role="checkbox" and aria-checked="true" when checked is true', () => {
      const { getAttribute, hasAria, hasTag, html } = render(
        <Checkbox checked={true} onCheckedChange={() => {}} label="Enable Notifications" />
      );

      expect(hasTag('input')).toBe(true);
      expect(getAttribute('type')).toBe('checkbox');
      expect(getAttribute('role')).toBe('checkbox');
      expect(hasAria('checked', 'true')).toBe(true);
      // Renders checkmark icon
      expect(html).toContain('<polyline');
    });

    it('renders with aria-checked="false" and no checkmark when checked is false', () => {
      const { hasAria, html } = render(
        <Checkbox checked={false} onCheckedChange={() => {}} label="Auto-publish" />
      );

      expect(hasAria('checked', 'false')).toBe(true);
      expect(html).not.toContain('<polyline');
    });

    it('enforces strict 4px rectilinear geometry on checkbox box (zero capsule styling)', () => {
      const { html } = render(<Checkbox checked={false} onCheckedChange={() => {}} />);

      // Radius must strictly match 4px (RADII.xs)
      expect(html).toContain('border-radius:4px');
      expect(html).toContain('width:18px');
      expect(html).toContain('height:18px');
    });

    it('renders label and description text slots cleanly', () => {
      const { hasText } = render(
        <Checkbox
          checked={false}
          onCheckedChange={() => {}}
          label="Multi-Account Sync"
          description="Sync changes across all connected Facebook pages immediately."
        />
      );

      expect(hasText('Multi-Account Sync')).toBe(true);
      expect(hasText('Sync changes across all connected Facebook pages immediately.')).toBe(true);
    });

    it('applies disabled attribute, not-allowed cursor, and reduced opacity when disabled', () => {
      const { hasAttribute, hasStyle } = render(
        <Checkbox checked={false} disabled onCheckedChange={() => {}} label="Locked Feature" />
      );

      expect(hasAttribute('disabled')).toBe(true);
      expect(hasStyle('cursor', 'not-allowed')).toBe(true);
      expect(hasStyle('opacity', '0.45')).toBe(true);
    });

    it('highlights background with Primary Gold when checked', () => {
      const { html } = render(<Checkbox checked={true} onCheckedChange={() => {}} />);

      expect(html).toContain(`background-color:${PALETTE.primary}`);
      expect(html).toContain(`border:1px solid ${PALETTE.primary}`);
    });
  });

  describe('Switch Component', () => {
    it('renders button with role="switch" and aria-checked="true" when checked', () => {
      const { getAttribute, hasAria, findByRole } = render(
        <Switch checked={true} onCheckedChange={() => {}} label="Dark Mode" />
      );

      expect(findByRole('switch')).toBe(true);
      expect(getAttribute('type')).toBe('button');
      expect(hasAria('checked', 'true')).toBe(true);
    });

    it('renders with aria-checked="false" when unchecked', () => {
      const { hasAria } = render(
        <Switch checked={false} onCheckedChange={() => {}} label="Auto Retry" />
      );

      expect(hasAria('checked', 'false')).toBe(true);
    });

    it('applies primary brand background and translated thumb when checked', () => {
      const { html } = render(<Switch checked={true} onCheckedChange={() => {}} />);

      expect(html).toContain(`background-color:${PALETTE.primary}`);
      expect(html).toContain('transform:translateX(18px)');
    });

    it('applies resting background and non-translated thumb when unchecked', () => {
      const { html } = render(<Switch checked={false} onCheckedChange={() => {}} />);

      expect(html).toContain('background-color:var(--bg-hover)');
      expect(html).toContain('transform:translateX(0)');
    });

    it('renders label and description text', () => {
      const { hasText } = render(
        <Switch
          checked={true}
          onCheckedChange={() => {}}
          label="Edge Cron Automation"
          description="Triggers worker runs every 1 minute on Cloudflare."
        />
      );

      expect(hasText('Edge Cron Automation')).toBe(true);
      expect(hasText('Triggers worker runs every 1 minute on Cloudflare.')).toBe(true);
    });

    it('handles disabled state with disabled attribute and not-allowed cursor', () => {
      const { hasAttribute, hasStyle } = render(
        <Switch checked={false} disabled onCheckedChange={() => {}} label="Disabled Switch" />
      );

      expect(hasAttribute('disabled')).toBe(true);
      expect(hasStyle('cursor', 'not-allowed')).toBe(true);
      expect(hasStyle('opacity', '0.45')).toBe(true);
    });

    it('renders hidden input when name attribute is provided for form submissions', () => {
      const { findTags } = render(
        <Switch name="notifications_enabled" checked={true} onCheckedChange={() => {}} />
      );

      const inputs = findTags('input');
      expect(inputs.length).toBe(1);
      expect(inputs[0].attributes['name']).toBe('notifications_enabled');
      expect(inputs[0].attributes['type']).toBe('checkbox');
    });
  });

  describe('Select Component', () => {
    const sampleOptions = [
      { value: 'page-1', label: 'Tech News Daily' },
      { value: 'page-2', label: 'Sports Highlights' },
      { value: 'page-3', label: 'Finance Hub (Disabled)', disabled: true },
    ];

    it('renders native select with provided options', () => {
      const { findTags, hasText } = render(
        <Select options={sampleOptions} value="page-1" />
      );

      const selects = findTags('select');
      expect(selects.length).toBe(1);

      const options = findTags('option');
      expect(options.length).toBe(3);
      expect(options[0].attributes['value']).toBe('page-1');
      expect(options[0].innerHTML).toBe('Tech News Daily');
      expect(options[2].attributes['disabled']).toBeDefined();
      expect(hasText('Tech News Daily')).toBe(true);
    });

    it('renders placeholder option as disabled and hidden default', () => {
      const { findTags } = render(
        <Select
          options={sampleOptions}
          placeholder="Select a destination page..."
        />
      );

      const options = findTags('option');
      // Placeholder is prepended
      expect(options.length).toBe(4);
      expect(options[0].attributes['value']).toBe('');
      expect(options[0].attributes['disabled']).toBeDefined();
      expect(options[0].attributes['hidden']).toBeDefined();
      expect(options[0].innerHTML).toBe('Select a destination page...');
    });

    it('renders custom chevron indicator with pointer-events:none and aria-hidden', () => {
      const { html } = render(
        <Select options={sampleOptions} />
      );

      // Contains chevron svg
      expect(html).toContain('<polyline points="6 9 12 15 18 9"');
      expect(html).toContain('pointer-events:none');
      expect(html).toContain('aria-hidden="true"');
      // Native dropdown appearance is suppressed
      expect(html).toContain('appearance:none');
    });

    it('associates label with select element via matching htmlFor and id', () => {
      const { html, getAttribute } = render(
        <Select id="page-picker" label="Target Facebook Page" options={sampleOptions} />
      );

      expect(getAttribute('id')).toBe('page-picker');
      expect(html).toContain('for="page-picker"');
      expect(html).toContain('Target Facebook Page');
    });

    it('renders helper text and associates with aria-describedby', () => {
      const { getAttribute, hasText } = render(
        <Select
          id="role-select"
          label="User Role"
          options={sampleOptions}
          helperText="Controls administrative permissions."
        />
      );

      expect(hasText('Controls administrative permissions.')).toBe(true);
      expect(getAttribute('aria-describedby')).toBe('role-select-helper');
    });

    it('renders error state with aria-invalid="true", role="alert", and Rose border', () => {
      const { html, getAttribute, hasAria, hasClass, hasStyle, hasText } = render(
        <Select
          id="category"
          label="Category"
          options={sampleOptions}
          error="Please select a valid category."
        />
      );

      expect(hasText('Please select a valid category.')).toBe(true);
      expect(hasAria('invalid', 'true')).toBe(true);
      expect(getAttribute('aria-describedby')).toBe('category-error');
      expect(hasClass('has-error')).toBe(true);
      expect(hasStyle('border', `1px solid ${PALETTE.accent3}`)).toBe(true);
      expect(html).toContain('role="alert"');
    });

    it('handles disabled state with disabled attribute, opacity, and not-allowed cursor', () => {
      const { hasAttribute, hasStyle } = render(
        <Select options={sampleOptions} disabled placeholder="Unavailable" />
      );

      expect(hasAttribute('disabled')).toBe(true);
      expect(hasStyle('cursor', 'not-allowed')).toBe(true);
      expect(hasStyle('opacity', '0.45')).toBe(true);
    });
  });
});
