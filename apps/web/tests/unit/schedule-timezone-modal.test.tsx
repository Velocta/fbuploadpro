import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  ScheduleTimezoneModal,
  Step1TimezoneSelector,
  Step2ReviewImpact,
} from '../../src/components/pages/dedicated/schedule-timezone-modal';

describe('ScheduleTimezoneModal (Spec 062)', () => {
  it('renders null when isOpen is false', () => {
    const html = renderToString(
      <ScheduleTimezoneModal
        isOpen={false}
        activeTimezone="UTC"
        slotsCount={3}
        pendingQueueCount={2}
        onClose={vi.fn()}
        onConfirmTimezone={vi.fn()}
      />
    );
    expect(html).toBe('');
  });

  it('renders Step 1 with current active timezone banner and search input', () => {
    const html = renderToString(
      <ScheduleTimezoneModal
        isOpen={true}
        activeTimezone="UTC"
        slotsCount={3}
        pendingQueueCount={2}
        onClose={vi.fn()}
        onConfirmTimezone={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="schedule-timezone-modal"');
    expect(html).toContain('data-testid="current-timezone-banner"');
    expect(html).toContain('data-testid="timezone-search-input"');
    expect(html).toContain('data-testid="proceed-to-step2-button"');
    expect(html).toContain('Change Schedule Timezone');
    expect(html).toContain('Select Target Timezone');
  });

  it('renders Step 1 directory grouped by regions with matching timezone options', () => {
    const html = renderToString(
      <Step1TimezoneSelector
        activeTimezone="America/New_York"
        selectedTimezone="America/New_York"
        searchQuery=""
        onSearchChange={vi.fn()}
        onSelectTimezone={vi.fn()}
        onCancel={vi.fn()}
        onProceed={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="timezone-region-group-Americas"');
    expect(html).toContain('data-testid="timezone-option-America/New_York"');
    expect(html).toContain('(Current)');
    // Proceed button disabled when selected === active
    expect(html).toContain('disabled');
  });

  it('enables proceed button when a different timezone is selected in Step 1', () => {
    const html = renderToString(
      <Step1TimezoneSelector
        activeTimezone="UTC"
        selectedTimezone="Asia/Karachi"
        searchQuery=""
        onSearchChange={vi.fn()}
        onSelectTimezone={vi.fn()}
        onCancel={vi.fn()}
        onProceed={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="proceed-to-step2-button"');
    expect(html).toContain('Next: Review Schedule Shift');
  });

  it('renders Step 2 review with comparison card, impact metrics, and clock-time note', () => {
    const html = renderToString(
      <Step2ReviewImpact
        activeTimezone="America/New_York"
        selectedTimezone="Asia/Karachi"
        slotsCount={4}
        pendingQueueCount={8}
        isSubmitting={false}
        errorMessage={null}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="timezone-transition-card"');
    expect(html).toContain('data-testid="timezone-impact-metrics"');
    expect(html).toContain('data-testid="confirm-timezone-update-button"');
    expect(html).toContain('data-testid="back-to-step1-button"');
    expect(html).toContain('America/New_York');
    expect(html).toContain('Asia/Karachi');
    expect(html).toContain('Recurring Slots');
    expect(html).toContain('Queued Posts Waiting');
    expect(html).toContain('Apply Timezone Shift');
  });

  it('displays error message in Step 2 when error is present', () => {
    const html = renderToString(
      <Step2ReviewImpact
        activeTimezone="UTC"
        selectedTimezone="Asia/Karachi"
        slotsCount={2}
        pendingQueueCount={1}
        isSubmitting={false}
        errorMessage="Network error updating schedule timezone"
        onBack={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="timezone-update-error"');
    expect(html).toContain('Network error updating schedule timezone');
  });
});
