'use client';

import React, { useState } from 'react';
import { THEME, SPACING, TYPOGRAPHY } from '@/lib/theme';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { PageSlotSummary } from '../tab-dashboard';
import {
  toDateTimeLocalValue,
  parseDateTimeLocalValue,
  formatSlotLong,
} from '../composer/queue-slot-utils';
import { findCollision, canSwapTimes } from './queue-logic';
import type { DedicatedQueueItem } from './queue-types';

export interface QueueRescheduleDialogProps {
  item: DedicatedQueueItem;
  items: DedicatedQueueItem[];
  slots: PageSlotSummary[];
  timeZone: string;
  onPatch: (id: string, data: Record<string, unknown>) => Promise<boolean>;
  onClose: () => void;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
}

/** Inline reschedule picker with collision warning + conditional time swap. */
export function QueueRescheduleDialog({
  item,
  items,
  slots,
  timeZone,
  onPatch,
  onClose,
  onSaved,
  onError,
}: Readonly<QueueRescheduleDialogProps>) {
  const [value, setValue] = useState(() =>
    toDateTimeLocalValue(new Date(item.scheduledTime), timeZone)
  );
  const [collision, setCollision] = useState<DedicatedQueueItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const minValue = toDateTimeLocalValue(new Date(), timeZone);

  const handleSave = async () => {
    setInlineError(null);
    const parsed = parseDateTimeLocalValue(value, timeZone);
    if (!parsed) {
      setInlineError('Pick a date and time for this post.');
      return;
    }
    if (parsed.getTime() <= Date.now()) {
      setInlineError('Pick a time in the future.');
      return;
    }
    const clashing = findCollision(items, item.id, parsed.toISOString());
    if (clashing) {
      setCollision(clashing);
      return;
    }
    setSaving(true);
    try {
      const ok = await onPatch(item.id, { scheduledTime: parsed.toISOString() });
      if (!ok) {
        onError("Couldn't reschedule this post. Please try again.");
        return;
      }
      onSaved(`Post rescheduled to ${formatSlotLong(parsed, timeZone)}.`);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleSwap = async () => {
    if (!collision) return;
    const parsed = parseDateTimeLocalValue(value, timeZone);
    if (!parsed) return;
    setSaving(true);
    try {
      const itemTime = item.scheduledTime;
      const first = await onPatch(item.id, { scheduledTime: parsed.toISOString() });
      const second = await onPatch(collision.id, { scheduledTime: itemTime });
      if (!first || !second) {
        onError("Couldn't swap the posting times. Please try again.");
        return;
      }
      onSaved(`Times swapped — post rescheduled to ${formatSlotLong(parsed, timeZone)}.`);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const swapAllowed = collision ? canSwapTimes(item, collision, slots, timeZone) : false;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent style={{ maxWidth: '440px' }}>
        <DialogHeader>
          <DialogTitle>Reschedule post</DialogTitle>
          <DialogDescription>
            {collision
              ? 'That time is already taken.'
              : 'Pick a new date and time for this post.'}
          </DialogDescription>
        </DialogHeader>

        {!collision && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sm }}>
            <label
              htmlFor="queue-reschedule-input"
              style={{
                fontSize: '0.8125rem',
                fontWeight: TYPOGRAPHY.weights.medium,
                color: `var(--text-main, ${THEME.default.text.primary})`,
              }}
            >
              New date and time
            </label>
            <input
              id="queue-reschedule-input"
              type="datetime-local"
              value={value}
              min={minValue}
              onChange={(event) => {
                setValue(event.target.value);
                setInlineError(null);
              }}
              style={{
                height: '38px',
                padding: `0 ${SPACING.sm}`,
                borderRadius: '6px',
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                backgroundColor: `var(--bg-active, ${THEME.default.surfaces.active})`,
                color: `var(--text-main, ${THEME.default.text.primary})`,
                fontSize: '0.875rem',
                colorScheme: 'dark',
              }}
            />
            {inlineError && (
              <p
                style={{
                  margin: 0,
                  fontSize: '0.8125rem',
                  color: `var(--text-sub, ${THEME.default.text.secondary})`,
                }}
              >
                {inlineError}
              </p>
            )}
          </div>
        )}

        {collision && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sm }}>
            <p
              style={{
                margin: 0,
                fontSize: '0.875rem',
                color: `var(--text-main, ${THEME.default.text.primary})`,
              }}
            >
              Another post is scheduled for{' '}
              {formatSlotLong(new Date(collision.scheduledTime), timeZone)}.
            </p>
            {!swapAllowed && (
              <p
                style={{
                  margin: 0,
                  fontSize: '0.8125rem',
                  color: `var(--text-sub, ${THEME.default.text.secondary})`,
                }}
              >
                The two posts need different posting times, so they can't swap.
              </p>
            )}
            <div style={{ display: 'flex', gap: SPACING.sm, flexWrap: 'wrap' }}>
              {swapAllowed && (
                <Button variant="secondary" size="sm" isLoading={saving} onClick={handleSwap}>
                  Swap times
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                disabled={saving}
                onClick={() => setCollision(null)}
              >
                Pick another time
              </Button>
            </div>
          </div>
        )}

        {!collision && (
          <DialogFooter>
            <Button variant="ghost" size="sm" disabled={saving} onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" isLoading={saving} onClick={handleSave}>
              Save new time
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
