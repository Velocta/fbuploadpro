/**
 * @file input.test.tsx
 * @description Unit and accessibility tests for Input and Textarea components (T006 / US1).
 * Tests input types, label associations, helper text, error aria-invalid, password toggle,
 * and textarea character counter, auto-expand rows, and error states.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { Input, Textarea } from '@/components/ui';
import { PALETTE } from '@/lib/theme';
import { render } from './setup';

describe('Input & Textarea Components (US1 / T006)', () => {
  describe('Input Component', () => {
    describe('Rendering & Types', () => {
      it('renders native input with default text type and 1px hairline border', () => {
        const { getAttribute, hasStyle, hasTag } = render(
          <Input placeholder="Enter username" />
        );

        expect(hasTag('input')).toBe(true);
        expect(getAttribute('type')).toBe('text');
        expect(getAttribute('placeholder')).toBe('Enter username');
        expect(hasStyle('border', '1px solid var(--border-subtle)')).toBe(true);
      });

      it('supports specific input types such as email, number, and tel', () => {
        const { getAttribute: getEmailType } = render(<Input type="email" />);
        expect(getEmailType('type')).toBe('email');

        const { getAttribute: getNumberType } = render(<Input type="number" />);
        expect(getNumberType('type')).toBe('number');

        const { getAttribute: getTelType } = render(<Input type="tel" />);
        expect(getTelType('type')).toBe('tel');
      });

      it('associates label with input using matching htmlFor and id', () => {
        const { html, getAttribute } = render(
          <Input id="user-email" label="Email Address" />
        );

        expect(getAttribute('id')).toBe('user-email');
        expect(html).toContain('for="user-email"');
        expect(html).toContain('Email Address');
      });

      it('auto-generates matching id and htmlFor when id is omitted', () => {
        const { html, findTags } = render(<Input label="Full Name" />);
        const labels = findTags('label');
        const inputs = findTags('input');

        expect(labels.length).toBe(1);
        expect(inputs.length).toBe(1);
        const forAttr = labels[0].attributes['for'];
        const idAttr = inputs[0].attributes['id'];

        expect(forAttr).toBeDefined();
        expect(idAttr).toBeDefined();
        expect(forAttr).toBe(idAttr);
      });
    });

    describe('Helper Text & Error States', () => {
      it('renders helper text and associates it via aria-describedby', () => {
        const { html, getAttribute, hasText } = render(
          <Input id="username" label="Username" helperText="Must be 3-20 characters long." />
        );

        expect(hasText('Must be 3-20 characters long.')).toBe(true);
        expect(getAttribute('aria-describedby')).toBe('username-helper');
        expect(html).toContain('id="username-helper"');
      });

      it('renders error state with aria-invalid="true", role="alert", and Rose border', () => {
        const { html, getAttribute, hasAria, hasClass, hasStyle, hasText } = render(
          <Input id="email" label="Email" error="Please enter a valid email address." />
        );

        expect(hasText('Please enter a valid email address.')).toBe(true);
        expect(hasAria('invalid', 'true')).toBe(true);
        expect(getAttribute('aria-describedby')).toBe('email-error');
        expect(hasClass('has-error')).toBe(true);
        expect(hasStyle('border', `1px solid ${PALETTE.accent3}`)).toBe(true);
        expect(html).toContain('role="alert"');
      });

      it('prioritizes error description over helperText in aria-describedby', () => {
        const { getAttribute, hasText } = render(
          <Input
            id="field"
            label="Field"
            helperText="Informational guidance."
            error="Required field missing."
          />
        );

        expect(getAttribute('aria-describedby')).toBe('field-error');
        expect(hasText('Required field missing.')).toBe(true);
        // Error replaces helper text display
        expect(hasText('Informational guidance.')).toBe(false);
      });
    });

    describe('Password Visibility Toggle', () => {
      it('renders toggle button with aria-label="Show password" when isPassword is true', () => {
        const { html, getAttribute, findTags } = render(
          <Input isPassword label="Password" />
        );

        expect(getAttribute('type')).toBe('password');
        const buttons = findTags('button');
        expect(buttons.length).toBe(1);
        expect(buttons[0].attributes['aria-label']).toBe('Show password');
        expect(buttons[0].attributes['type']).toBe('button');
        expect(html).toContain('<svg');
      });

      it('automatically enables password toggle when type="password"', () => {
        const { getAttribute, findTags } = render(
          <Input type="password" label="Account Password" />
        );

        expect(getAttribute('type')).toBe('password');
        const buttons = findTags('button');
        expect(buttons.length).toBe(1);
        expect(buttons[0].attributes['aria-label']).toBe('Show password');
      });

      it('disables toggle button when Input is disabled', () => {
        const { findTags } = render(
          <Input isPassword disabled label="Password" />
        );

        const buttons = findTags('button');
        expect(buttons.length).toBe(1);
        expect(buttons[0].attributes['disabled']).toBeDefined();
      });
    });

    describe('Icon Slots & Disabled State', () => {
      it('renders left icon with pointer-events-none and aria-hidden', () => {
        const { html } = render(
          <Input leftIcon={<span id="search-glass">🔍</span>} placeholder="Search records" />
        );

        expect(html).toContain('id="search-glass"');
        expect(html).toContain('pointer-events:none');
        expect(html).toContain('aria-hidden="true"');
      });

      it('renders right icon when not in password mode', () => {
        const { html } = render(
          <Input rightIcon={<span id="status-icon">✓</span>} />
        );

        expect(html).toContain('id="status-icon"');
        expect(html).toContain('aria-hidden="true"');
      });

      it('applies disabled attributes, not-allowed cursor, and reduced opacity', () => {
        const { hasAttribute, hasStyle } = render(
          <Input disabled placeholder="Locked input" />
        );

        expect(hasAttribute('disabled')).toBe(true);
        expect(hasStyle('cursor', 'not-allowed')).toBe(true);
        expect(hasStyle('opacity', '0.45')).toBe(true);
      });
    });
  });

  describe('Textarea Component', () => {
    describe('Rendering & Sizing', () => {
      it('renders textarea element with default 4 rows and 1px hairline border', () => {
        const { getAttribute, hasStyle, hasTag } = render(
          <Textarea placeholder="Write caption..." />
        );

        expect(hasTag('textarea')).toBe(true);
        expect(getAttribute('rows')).toBe('4');
        expect(getAttribute('placeholder')).toBe('Write caption...');
        expect(hasStyle('border', '1px solid var(--border-subtle)')).toBe(true);
      });

      it('respects custom rows prop for auto-expand sizing', () => {
        const { getAttribute } = render(<Textarea rows={8} />);
        expect(getAttribute('rows')).toBe('8');
      });

      it('associates label with textarea via matching htmlFor and id', () => {
        const { html, getAttribute } = render(
          <Textarea id="caption-body" label="Post Caption" />
        );

        expect(getAttribute('id')).toBe('caption-body');
        expect(html).toContain('for="caption-body"');
        expect(html).toContain('Post Caption');
      });
    });

    describe('Character Counter', () => {
      it('displays character counter when showCount is true', () => {
        const { hasText, hasClass } = render(
          <Textarea showCount defaultValue="Hello World" />
        );

        expect(hasText('11')).toBe(true);
        expect(hasClass('tabular-nums')).toBe(true);
      });

      it('displays character limit when maxLength is defined', () => {
        const { getAttribute, hasText } = render(
          <Textarea maxLength={280} defaultValue="Sample post" />
        );

        expect(getAttribute('maxLength')).toBe('280');
        expect(hasText('11 / 280')).toBe(true);
      });

      it('renders character count with Rose accent color when length reaches maxLength', () => {
        const fullText = 'A'.repeat(50);
        const { html } = render(
          <Textarea maxLength={50} defaultValue={fullText} />
        );

        expect(html).toContain('50 / 50');
        expect(html).toContain(`color:${PALETTE.accent3}`);
      });
    });

    describe('Error & Disabled States', () => {
      it('renders error state with aria-invalid="true", role="alert", and Rose border', () => {
        const { html, getAttribute, hasAria, hasClass, hasStyle, hasText } = render(
          <Textarea id="bio" label="Bio" error="Bio exceeds permitted length." />
        );

        expect(hasText('Bio exceeds permitted length.')).toBe(true);
        expect(hasAria('invalid', 'true')).toBe(true);
        expect(getAttribute('aria-describedby')).toBe('bio-error');
        expect(hasClass('has-error')).toBe(true);
        expect(hasStyle('border', `1px solid ${PALETTE.accent3}`)).toBe(true);
        expect(html).toContain('role="alert"');
      });

      it('renders helper text when error is not present', () => {
        const { getAttribute, hasText } = render(
          <Textarea id="notes" label="Notes" helperText="Plain text markdown supported." />
        );

        expect(hasText('Plain text markdown supported.')).toBe(true);
        expect(getAttribute('aria-describedby')).toBe('notes-helper');
      });

      it('disables textarea and applies not-allowed cursor and reduced opacity', () => {
        const { hasAttribute, hasStyle } = render(
          <Textarea disabled placeholder="Archived notes" />
        );

        expect(hasAttribute('disabled')).toBe(true);
        expect(hasStyle('cursor', 'not-allowed')).toBe(true);
        expect(hasStyle('opacity', '0.45')).toBe(true);
      });
    });
  });
});
