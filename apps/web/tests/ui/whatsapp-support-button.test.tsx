/**
 * @file whatsapp-support-button.test.tsx
 * @description UI tests for WhatsAppSupportButton component (Spec 063).
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WhatsAppSupportButton } from '@/components/support/whatsapp-support-button';
import { render } from '../components/setup';

describe('WhatsAppSupportButton Component (Spec 063)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER;
    delete process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT_MESSAGE;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('renders nothing when no environment variable or prop is configured', () => {
    const { html } = render(<WhatsAppSupportButton />);
    expect(html).toBe('');
  });

  it('renders custom phone number and message when passed via props', () => {
    const { hasAttribute } = render(
      <WhatsAppSupportButton
        phoneNumber="+92 (300) 123-4567"
        defaultMessage="Need urgent support"
      />
    );

    expect(
      hasAttribute(
        'href',
        'https://wa.me/923001234567?text=Need%20urgent%20support'
      )
    ).toBe(true);
  });

  it('reads phone number and greeting from environment variables', () => {
    process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER = '+44 20 7946 0958';
    process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT_MESSAGE = 'Hello from London!';

    const { hasAttribute } = render(<WhatsAppSupportButton />);

    expect(
      hasAttribute(
        'href',
        'https://wa.me/442079460958?text=Hello%20from%20London!'
      )
    ).toBe(true);
  });

  it('contains the WhatsApp SVG icon when rendered', () => {
    const { hasTag, findTags } = render(
      <WhatsAppSupportButton phoneNumber="+15551234567" />
    );

    expect(hasTag('svg')).toBe(true);
    const svgs = findTags('svg');
    expect(svgs.length).toBeGreaterThan(0);
    expect(svgs[0].innerHTML).toContain('path');
  });
});
