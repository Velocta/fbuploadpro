import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('server-only', () => ({}))

import { projectScheduledTimes } from './inapp-schedule-service'

// Mock dependencies that require server environment
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))
vi.mock('@/lib/r2/user-media', () => ({
  createPresignedDownloadUrl: vi.fn(),
}))
vi.mock('@/server/services/tokens/token-cost-service', () => ({
  getTokenCostForFeature: vi.fn(),
  deductAgencyTokens: vi.fn(),
  refundAgencyTokens: vi.fn(),
  requireAgencyHasTokens: vi.fn(),
}))

describe('projectScheduledTimes', () => {
  beforeEach(() => {
    // Fix current time: 2026-09-19 14:00:00 UTC (2:00 PM)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-19T14:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('projects 8 pending posts across future daily slots without picking past slots', () => {
    // Page configured with 4 slots per day: 09:00 AM, 01:00 PM, 05:00 PM, 09:00 PM (UTC)
    const postingTimes = ['09:00 AM', '01:00 PM', '05:00 PM', '09:00 PM']
    const timezone = 'UTC'

    // At 14:00 UTC, 09:00 and 13:00 have passed.
    // Upcoming slots should be:
    // Slot 0: 2026-09-19 17:00:00Z (today 5 PM)
    // Slot 1: 2026-09-19 21:00:00Z (today 9 PM)
    // Slot 2: 2026-09-20 09:00:00Z (tomorrow 9 AM)
    // Slot 3: 2026-09-20 13:00:00Z (tomorrow 1 PM)
    // Slot 4: 2026-09-20 17:00:00Z (tomorrow 5 PM)
    // Slot 5: 2026-09-20 21:00:00Z (tomorrow 9 PM)
    // Slot 6: 2026-09-21 09:00:00Z (day after tomorrow 9 AM)
    // Slot 7: 2026-09-21 13:00:00Z (day after tomorrow 1 PM)
    const posts = Array.from({ length: 8 }, (_, i) => ({
      id: `post-${i + 1}`,
      status: 'pending',
    }))

    const projected = projectScheduledTimes(posts, postingTimes, timezone)

    expect(projected).toHaveLength(8)
    expect(projected[0]!.scheduled_at).toBe('2026-09-19T17:00:00.000Z')
    expect(projected[1]!.scheduled_at).toBe('2026-09-19T21:00:00.000Z')
    expect(projected[2]!.scheduled_at).toBe('2026-09-20T09:00:00.000Z')
    expect(projected[3]!.scheduled_at).toBe('2026-09-20T13:00:00.000Z')
    expect(projected[4]!.scheduled_at).toBe('2026-09-20T17:00:00.000Z')
    expect(projected[5]!.scheduled_at).toBe('2026-09-20T21:00:00.000Z')
    expect(projected[6]!.scheduled_at).toBe('2026-09-21T09:00:00.000Z')
    expect(projected[7]!.scheduled_at).toBe('2026-09-21T13:00:00.000Z')
  })

  it('does not skip a slot that is 5 minutes in the future', () => {
    // Current time: 08:55:00 UTC
    vi.setSystemTime(new Date('2026-09-19T08:55:00Z'))

    const postingTimes = ['09:00 AM', '03:00 PM']
    const posts = [{ id: 'post-1', status: 'pending' }]

    const projected = projectScheduledTimes(posts, postingTimes, 'UTC')

    // Slot at 09:00 AM is 5 minutes away; it should NOT be skipped
    expect(projected[0]!.scheduled_at).toBe('2026-09-19T09:00:00.000Z')
  })

  it('correctly skips a slot that elapsed more than 1 minute ago', () => {
    // Current time: 09:02:00 UTC (2 minutes after 09:00)
    vi.setSystemTime(new Date('2026-09-19T09:02:00Z'))

    const postingTimes = ['09:00 AM', '03:00 PM']
    const posts = [{ id: 'post-1', status: 'pending' }]

    const projected = projectScheduledTimes(posts, postingTimes, 'UTC')

    // 09:00 AM elapsed; next upcoming slot is 03:00 PM
    expect(projected[0]!.scheduled_at).toBe('2026-09-19T15:00:00.000Z')
  })

  it('preserves published/failed post timestamps without offsetting pending slot indices', () => {
    vi.setSystemTime(new Date('2026-09-19T14:00:00Z'))

    const postingTimes = ['09:00 AM', '05:00 PM']
    const posts = [
      {
        id: 'post-1',
        status: 'published',
        published_at: '2026-09-19T09:00:00.000Z',
      },
      {
        id: 'post-2',
        status: 'failed',
        updated_at: '2026-09-18T17:00:00.000Z',
      },
      {
        id: 'post-3',
        status: 'pending',
      },
    ]

    const projected = projectScheduledTimes(posts, postingTimes, 'UTC')

    expect(projected[0]!.scheduled_at).toBe('2026-09-19T09:00:00.000Z')
    expect(projected[1]!.scheduled_at).toBe('2026-09-18T17:00:00.000Z')
    // Pending post should get the FIRST upcoming slot (17:00 today), not slot[2]
    expect(projected[2]!.scheduled_at).toBe('2026-09-19T17:00:00.000Z')
  })
})
