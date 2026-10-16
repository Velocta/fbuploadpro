'use client';

/**
 * Backwards compatibility wrapper for PageTabCalendar.
 * Spec 058 renames and redesigns this view into PageTabPostingTimes.
 */
export {
  PageTabPostingTimes as PageTabCalendar,
  type PageTabPostingTimesProps as PageTabCalendarProps,
  PageTabPostingTimes,
  type PageTabPostingTimesProps,
} from './tab-posting-times';
