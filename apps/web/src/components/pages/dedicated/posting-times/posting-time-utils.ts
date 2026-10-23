/**
 * Posting-times shared helpers (spec 134 PR-134-2).
 *
 * The 12-hour slot formatter is the spec 106/112 shared formatter: the
 * dashboard tab and the posting-times surface both render slot times
 * through it, so it lives here — its one home — and both surfaces import
 * it (spec 134 §3.7: the formatter stays shared, never forked).
 */

export const ALL_POST_FORMATS: Array<{ id: string; label: string }> = [
  { id: 'reel', label: 'Reels' },
  { id: 'image', label: 'Photos' },
  { id: 'video', label: 'Videos' },
  { id: 'story', label: 'Stories' },
  { id: 'text', label: 'Text Updates' },
];

export interface FormattedSlotTime {
  time12: string;
  ampm: string;
  time24: string;
}

export function formatSlotDisplay(slotTime: string): FormattedSlotTime {
  const parts = slotTime.split(':');
  const rawHour = Number.parseInt(parts[0] || '9', 10);
  const rawMinute = Number.parseInt(parts[1] || '0', 10);

  const hour12 = rawHour % 12 === 0 ? 12 : rawHour % 12;
  const ampm = rawHour >= 12 ? 'PM' : 'AM';
  const paddedMinute = rawMinute < 10 ? `0${rawMinute}` : `${rawMinute}`;
  const paddedHour12 = hour12 < 10 ? `0${hour12}` : `${hour12}`;
  const paddedHour24 = rawHour < 10 ? `0${rawHour}` : `${rawHour}`;

  return {
    time12: `${paddedHour12}:${paddedMinute}`,
    ampm,
    time24: `${paddedHour24}:${paddedMinute}`,
  };
}

export function resolveFormatLabel(formatId: string): string {
  const match = ALL_POST_FORMATS.find((f) => f.id === formatId);
  return match ? match.label : formatId.toUpperCase();
}

export interface PostingTimeFormInitialState {
  timeInput: string;
  selectedFormats: string[];
}

/**
 * Initial form state for the Add/Edit posting-time dialog, always derived
 * from the slot being edited (or the defaults for Add). The dialog is only
 * mounted while open and is keyed per slot, so this runs fresh on every
 * open — an Edit can never inherit the value typed into a previous Add
 * (spec 112 #19, regression-tested beside the form).
 */
export function getPostingTimeFormInitialState(
  slotToEdit?: { slotTime: string; allowedFormats?: string[] | null } | null
): PostingTimeFormInitialState {
  return {
    timeInput: slotToEdit?.slotTime.slice(0, 5) || '09:00',
    selectedFormats:
      slotToEdit?.allowedFormats && slotToEdit.allowedFormats.length > 0
        ? [...slotToEdit.allowedFormats]
        : [...ALL_POST_FORMATS.map((format) => format.id)],
  };
}
