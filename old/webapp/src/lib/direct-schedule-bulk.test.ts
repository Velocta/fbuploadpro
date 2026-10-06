import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { addDays, format } from 'date-fns'
import {
  generateBulkScheduleTimestamps,
  ensurePostingTimesLength,
  BULK_SCHEDULE_MAX_ITEMS,
} from './direct-schedule-bulk'

describe('ensurePostingTimesLength', () => {
  it('pads empty slots when posts per day increases', () => {
    expect(ensurePostingTimesLength(['09:00 AM'], 3)).toEqual(['09:00 AM', '', ''])
  })

  it('trims extra slots when posts per day decreases', () => {
    expect(ensurePostingTimesLength(['09:00 AM', '12:00 PM', '03:00 PM'], 2)).toEqual([
      '09:00 AM',
      '12:00 PM',
    ])
  })
})

describe('generateBulkScheduleTimestamps', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-23T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns one timestamp per item with fixed slots', () => {
    const startDate = format(addDays(new Date(), 1), 'yyyy-MM-dd')
    const result = generateBulkScheduleTimestamps(3, {
      startDate,
      postsPerDay: 2,
      scheduleType: 'fixed',
      postingTimes: ['09:00 AM', '03:00 PM'],
      timezone: 'UTC',
    })
    expect(result).toHaveLength(3)
    result.forEach((iso) => expect(new Date(iso).getTime()).toBeGreaterThan(Date.now()))
  })

  it('returns correct count for dailyrandom across multiple days', () => {
    const startDate = format(addDays(new Date(), 1), 'yyyy-MM-dd')
    const result = generateBulkScheduleTimestamps(5, {
      startDate,
      postsPerDay: 2,
      scheduleType: 'dailyrandom',
      postingTimes: [],
      timezone: 'UTC',
    })
    expect(result).toHaveLength(5)
  })

  it('rejects batches over the max item limit', () => {
    const startDate = format(addDays(new Date(), 1), 'yyyy-MM-dd')
    expect(() =>
      generateBulkScheduleTimestamps(BULK_SCHEDULE_MAX_ITEMS + 1, {
        startDate,
        postsPerDay: 1,
        scheduleType: 'dailyrandom',
        postingTimes: [],
        timezone: 'UTC',
      }),
    ).toThrow(/at most/)
  })

  it('rejects start times within 10 minutes', () => {
    const startDate = format(new Date(), 'yyyy-MM-dd')
    expect(() =>
      generateBulkScheduleTimestamps(1, {
        startDate,
        postsPerDay: 1,
        scheduleType: 'fixed',
        postingTimes: ['12:05 AM'],
        timezone: 'UTC',
      }),
    ).toThrow(/10 minutes/)
  })

  it('rejects empty fixed slots', () => {
    const startDate = format(addDays(new Date(), 2), 'yyyy-MM-dd')
    expect(() =>
      generateBulkScheduleTimestamps(2, {
        startDate,
        postsPerDay: 2,
        scheduleType: 'fixed',
        postingTimes: ['09:00 AM', ''],
        timezone: 'UTC',
      }),
    ).toThrow(/fixed posting time/)
  })
})
