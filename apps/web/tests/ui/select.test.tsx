/**
 * @file select.test.tsx
 * @description Width-contract tests for the shared/ui Select trigger:
 * it sizes to content (`w-fit`, so toolbar selects stay intrinsic on
 * wide layouts) but is capped at its container (`max-w-full` +
 * `min-w-0` on the trigger; the value gets `min-w-0` + `truncate`
 * through the trigger's descendant selectors, because Radix's
 * Select.Value swallows its own className), so a long placeholder
 * can never push the trigger past a narrow column
 * — the 321px-in-a-320px-viewport overflow the spec 132 composer
 * builds measured before this contract landed at the primitive.
 * Layout proof lives in the Playwright suite (destination-composers
 * trial-reel select at 320px); jsdom cannot measure boxes, so these
 * tests pin the class contract the layout behaviour is built from,
 * including that a consumer's `w-full` still wins the merge.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import {
  Select,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/ui/select';

function renderTrigger(triggerClassName?: string) {
  render(
    <Select>
      <SelectTrigger data-testid="probe-trigger" className={triggerClassName}>
        <SelectValue placeholder="Choose who can see this video" />
      </SelectTrigger>
    </Select>
  );
  return screen.getByTestId('probe-trigger');
}

/** Exact class tokens (substring checks would confuse max-w-full with w-full). */
function tokens(el: Element | null | undefined): Set<string> {
  return new Set((el?.className ?? '').split(/\s+/).filter(Boolean));
}

describe('shared/ui Select — trigger width contract', () => {
  it('sizes to content but caps at the container, with a truncating value', () => {
    const trigger = renderTrigger();
    const classes = tokens(trigger);
    expect(classes.has('w-fit')).toBe(true);
    expect(classes.has('max-w-full')).toBe(true);
    expect(classes.has('min-w-0')).toBe(true);
    expect(classes.has('w-full')).toBe(false);
    // The value truncates via the trigger's descendant selectors —
    // Radix's Select.Value swallows its own className, so the
    // classes cannot live on the value element itself.
    expect(classes.has('[&>[data-slot=select-value]]:min-w-0')).toBe(true);
    expect(classes.has('[&>[data-slot=select-value]]:truncate')).toBe(true);

    const value = trigger.querySelector('[data-slot="select-value"]');
    expect(value).not.toBeNull();
  });

  it('lets a consumer force full width (the merge drops w-fit)', () => {
    const trigger = renderTrigger('w-full');
    const classes = tokens(trigger);
    expect(classes.has('w-full')).toBe(true);
    expect(classes.has('w-fit')).toBe(false);
    // The container cap stays even when full-width is forced.
    expect(classes.has('max-w-full')).toBe(true);
  });
});
