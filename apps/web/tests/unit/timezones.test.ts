import { describe, expect, it } from 'vitest';
import {
  findTimezoneEntry,
  getTimezoneCurrentTime,
  getTimezoneUtcOffset,
  searchAndGroupTimezones,
  TIMEZONE_REGISTRY,
} from '../../src/lib/timezones';

describe('Timezone Registry & Helpers (Spec 062)', () => {
  describe('getTimezoneUtcOffset', () => {
    it('returns UTC+00:00 for UTC', () => {
      expect(getTimezoneUtcOffset('UTC')).toBe('UTC+00:00');
    });

    it('returns formatted offset for Asia/Karachi (UTC+05:00)', () => {
      const offset = getTimezoneUtcOffset('Asia/Karachi');
      expect(offset).toBe('UTC+05:00');
    });

    it('falls back safely to UTC on invalid timezone string', () => {
      expect(getTimezoneUtcOffset('Invalid/Timezone_Name')).toBe('UTC');
    });
  });

  describe('getTimezoneCurrentTime', () => {
    it('formats valid local time string with AM/PM', () => {
      const fixedDate = new Date('2026-10-20T12:00:00.000Z');
      const timeStr = getTimezoneCurrentTime('UTC', fixedDate);
      expect(timeStr).toContain('12:00');
      expect(timeStr).toContain('PM');
    });

    it('returns empty string on invalid timezone', () => {
      expect(getTimezoneCurrentTime('Invalid/Timezone_Name')).toBe('');
    });
  });

  describe('findTimezoneEntry', () => {
    it('finds existing registered timezone entry', () => {
      const entry = findTimezoneEntry('Asia/Karachi');
      expect(entry.city).toContain('Karachi');
      expect(entry.country).toBe('Pakistan');
      expect(entry.region).toBe('Asia');
    });

    it('synthesizes entry for unlisted Americas IANA string', () => {
      const entry = findTimezoneEntry('America/Costa_Rica');
      expect(entry.iana).toBe('America/Costa_Rica');
      expect(entry.city).toBe('Costa Rica');
      expect(entry.region).toBe('Americas');
    });

    it('synthesizes entry for unlisted European IANA string', () => {
      const entry = findTimezoneEntry('Europe/Oslo');
      expect(entry.iana).toBe('Europe/Oslo');
      expect(entry.city).toBe('Oslo');
      expect(entry.region).toBe('Europe');
    });

    it('synthesizes entry for unlisted Pacific IANA string', () => {
      const entry = findTimezoneEntry('Pacific/Tahiti');
      expect(entry.iana).toBe('Pacific/Tahiti');
      expect(entry.region).toBe('Pacific');
    });

    it('synthesizes entry for unlisted Africa IANA string', () => {
      const entry = findTimezoneEntry('Africa/Accra');
      expect(entry.iana).toBe('Africa/Accra');
      expect(entry.region).toBe('Africa');
    });

    it('synthesizes entry for unknown format', () => {
      const entry = findTimezoneEntry('CustomUnknown');
      expect(entry.iana).toBe('CustomUnknown');
      expect(entry.region).toBe('Global');
    });
  });

  describe('searchAndGroupTimezones', () => {
    it('returns all registered timezones grouped by region when query is empty', () => {
      const grouped = searchAndGroupTimezones('');
      let totalCount = 0;
      for (const region of Object.keys(grouped) as Array<keyof typeof grouped>) {
        totalCount += grouped[region].length;
      }
      expect(totalCount).toBe(TIMEZONE_REGISTRY.length);
      expect(grouped.Asia.length).toBeGreaterThan(0);
      expect(grouped.Americas.length).toBeGreaterThan(0);
      expect(grouped.Europe.length).toBeGreaterThan(0);
    });

    it('filters by city name (e.g. karachi)', () => {
      const grouped = searchAndGroupTimezones('karachi');
      expect(grouped.Asia.some((tz) => tz.iana === 'Asia/Karachi')).toBe(true);
      expect(grouped.Americas).toHaveLength(0);
    });

    it('filters by country name (e.g. pakistan)', () => {
      const grouped = searchAndGroupTimezones('pakistan');
      expect(grouped.Asia.some((tz) => tz.iana === 'Asia/Karachi')).toBe(true);
    });

    it('filters by IANA name (e.g. New_York)', () => {
      const grouped = searchAndGroupTimezones('New_York');
      expect(grouped.Americas.some((tz) => tz.iana === 'America/New_York')).toBe(true);
      expect(grouped.Europe).toHaveLength(0);
    });

    it('returns all empty groups when search matches nothing', () => {
      const grouped = searchAndGroupTimezones('nonexistent_city_xyz');
      expect(grouped.Americas).toHaveLength(0);
      expect(grouped.Asia).toHaveLength(0);
      expect(grouped.Europe).toHaveLength(0);
    });
  });
});
