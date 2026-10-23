'use client';

import * as React from 'react';
import { Button } from '@/components/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/shared/ui/dialog';
import { Input } from '@/components/shared/ui/input';
import type { PageSlotSummary } from '../tab-dashboard';
import {
  formatSlotLong,
  parseDateTimeLocalValue,
  toDateTimeLocalValue,
} from '../composer/queue-slot-utils';
import { canSwapTimes, findCollision } from './queue-logic';
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

/**
 * Reschedule dialog on the shared/ui Dialog (spec 134 §3.1.1: direct time
 * editing is reorder's non-drag twin). Past times are unselectable
 * (spec 105 §5.1.3); a collision offers Swap only when both posts'
 * formats fit both slots (queue-logic's canSwapTimes, preserved).
 * Loaded via next/dynamic by the panel (closed by default).
 */
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
  const [value, setValue] = React.useState(() =>
    toDateTimeLocalValue(new Date(item.scheduledTime), timeZone)
  );
  const [collision, setCollision] = React.useState<DedicatedQueueItem | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [inlineError, setInlineError] = React.useState<string | null>(null);

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
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reschedule post</DialogTitle>
          <DialogDescription>
            {collision ? 'That time is already taken.' : 'Pick a new date and time for this post.'}
          </DialogDescription>
        </DialogHeader>

        {!collision && (
          <div className="flex flex-col gap-2">
            <label htmlFor="queue-reschedule-input" className="text-body font-medium text-ink">
              New date and time
            </label>
            <Input
              id="queue-reschedule-input"
              data-testid="queue-reschedule-input"
              type="datetime-local"
              value={value}
              min={minValue}
              onChange={(event) => {
                setValue(event.target.value);
                setInlineError(null);
              }}
            />
            {inlineError && (
              <p role="alert" className="m-0 text-body text-brand-rose">
                {inlineError}
              </p>
            )}
          </div>
        )}

        {collision && (
          <div className="flex flex-col gap-2">
            <p className="m-0 text-body text-ink">
              Another post is scheduled for{' '}
              {formatSlotLong(new Date(collision.scheduledTime), timeZone)}.
            </p>
            {!swapAllowed && (
              <p className="m-0 text-body text-ink-sub">
                The two posts need different posting times, so they can&apos;t swap.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {swapAllowed && (
                <Button variant="secondary" loading={saving} onClick={() => void handleSwap()}>
                  Swap times
                </Button>
              )}
              <Button variant="ghost" disabled={saving} onClick={() => setCollision(null)}>
                Pick another time
              </Button>
            </div>
          </div>
        )}

        {!collision && (
          <DialogFooter>
            <Button variant="ghost" disabled={saving} onClick={onClose}>
              Cancel
            </Button>
            <Button loading={saving} onClick={() => void handleSave()}>
              Save new time
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default QueueRescheduleDialog;
