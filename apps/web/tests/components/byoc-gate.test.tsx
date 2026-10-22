/**
 * @file byoc-gate.test.tsx
 * @description Spec 123 Part C: point-of-need credentials gate (T7).
 * The gate blocks only when app details are known to be missing; it
 * renders the connect action while checking, when details are present,
 * and when the check itself failed (fail open, mirroring PR #641).
 */
import React from 'react';
import { describe, expect, it } from 'vitest';
import {
  ByocGate,
  isByocGateBlocking,
  type ByocGateStatus,
} from '@/components/connect/byoc-gate';
import {
  DestinationPicker,
  destinationSubtitle,
  findDuplicateDestinationNames,
} from '@/components/connect/destination-picker';
import { render } from './setup';

describe('isByocGateBlocking (PR #641 semantics)', () => {
  it('blocks when the check finished and details are missing', () => {
    const status: ByocGateStatus = {
      isLoading: false,
      hasCredentials: false,
      error: null,
    };
    expect(isByocGateBlocking(status)).toBe(true);
  });

  it('does not block while the check is running', () => {
    expect(
      isByocGateBlocking({ isLoading: true, hasCredentials: false, error: null })
    ).toBe(false);
  });

  it('does not block when details are present', () => {
    expect(
      isByocGateBlocking({ isLoading: false, hasCredentials: true, error: null })
    ).toBe(false);
  });

  it('fails open when the check itself errored', () => {
    expect(
      isByocGateBlocking({
        isLoading: false,
        hasCredentials: false,
        error: "Couldn't verify your app details just now.",
      })
    ).toBe(false);
  });
});

describe('ByocGate rendering', () => {
  const child = <span>Connect Instagram now</span>;

  it('renders the point-of-need prompt with inline steps when details are missing', () => {
    const { html, hasText } = render(
      <ByocGate
        platform="instagram"
        platformName="Instagram"
        subdomain="acme"
        initialStatus={{ isLoading: false, hasCredentials: false, error: null }}
      >
        {child}
      </ByocGate>
    );
    expect(hasText('Add your Instagram app details first')).toBe(true);
    expect(hasText('Create a Meta app for your business.')).toBe(true);
    expect(hasText('Connect Instagram now')).toBe(false);
    expect(html).toContain('/tenant/acme/settings?tab=instagram');
    expect(html).toContain('data-testid="byoc-gate-prompt"');
  });

  it('names the Threads pair trap in the Threads gate steps', () => {
    const { hasText } = render(
      <ByocGate
        platform="threads"
        platformName="Threads"
        subdomain="acme"
        initialStatus={{ isLoading: false, hasCredentials: false, error: null }}
      >
        {child}
      </ByocGate>
    );
    expect(hasText('Add your Threads app details first')).toBe(true);
    expect(
      hasText('this pair is different from your main app pair')
    ).toBe(true);
  });

  it('renders children when details are present', () => {
    const { hasText } = render(
      <ByocGate
        platform="instagram"
        platformName="Instagram"
        subdomain="acme"
        initialStatus={{ isLoading: false, hasCredentials: true, error: null }}
      >
        {child}
      </ByocGate>
    );
    expect(hasText('Connect Instagram now')).toBe(true);
    expect(hasText('Add your Instagram app details first')).toBe(false);
  });

  it('renders children when the credentials check failed (fail open)', () => {
    const { hasText } = render(
      <ByocGate
        platform="instagram"
        platformName="Instagram"
        subdomain="acme"
        initialStatus={{
          isLoading: false,
          hasCredentials: false,
          error: "Couldn't verify your app details just now.",
        }}
      >
        {child}
      </ByocGate>
    );
    expect(hasText('Connect Instagram now')).toBe(true);
    expect(hasText('Add your Instagram app details first')).toBe(false);
  });

  it('uses no protocol jargon in the gate copy', () => {
    const { html } = render(
      <ByocGate
        platform="instagram"
        platformName="Instagram"
        subdomain="acme"
        initialStatus={{ isLoading: false, hasCredentials: false, error: null }}
      >
        {child}
      </ByocGate>
    );
    expect(html).not.toMatch(/oauth|scope|endpoint/i);
  });
});

describe('Destination picker disambiguation (spec 109 behaviour)', () => {
  const destinations = [
    { externalDestinationId: 'dest-1001', name: 'My Brand', handle: 'mybrand.one' },
    { externalDestinationId: 'dest-2002', name: 'My Brand', handle: 'mybrand.two' },
    { externalDestinationId: 'dest-3003', name: 'Side Project', handle: 'sideproject' },
  ];

  it('flags only the names that appear more than once', () => {
    const duplicates = findDuplicateDestinationNames(destinations);
    expect(duplicates.has('my brand')).toBe(true);
    expect(duplicates.has('side project')).toBe(false);
  });

  it('distinguishes same-name rows by handle and ID suffix, unique names by handle only', () => {
    const duplicate = findDuplicateDestinationNames(destinations);
    const first = destinationSubtitle(
      destinations[0],
      duplicate.has('my brand')
    );
    expect(first).toContain('@mybrand.one');
    expect(first).toContain('ID …');
    const unique = destinationSubtitle(
      destinations[2],
      duplicate.has('side project')
    );
    expect(unique).toBe('@sideproject');
  });

  it('renders same-name destinations as separate rows, never merged', () => {
    const { html, hasText } = render(
      <DestinationPicker
        platform="instagram"
        subdomain="acme"
        destinations={destinations}
        mode="picker"
      />
    );
    expect(html).toContain('data-testid="destination-row-dest-1001"');
    expect(html).toContain('data-testid="destination-row-dest-2002"');
    expect(html).toContain('data-testid="destination-row-dest-3003"');
    expect(hasText('@mybrand.one')).toBe(true);
    expect(hasText('@mybrand.two')).toBe(true);
  });

  it('single-confirm mode shows the one destination with a confirm button', () => {
    const { html, hasText } = render(
      <DestinationPicker
        platform="x"
        subdomain="acme"
        destinations={[
          { externalDestinationId: 'x-1', name: 'Fixture X', handle: 'fixturex' },
        ]}
        mode="single-confirm"
      />
    );
    expect(hasText('Fixture X')).toBe(true);
    expect(hasText('Add this X destination')).toBe(true);
    expect(html).not.toContain('type="checkbox"');
  });
});
