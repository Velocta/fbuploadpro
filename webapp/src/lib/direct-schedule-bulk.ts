import { addDays, format, parse, parseISO } from 'date-fns'
import { fromZonedTime } from 'date-fns-tz'
import { generateBalancedPostTimes } from '@/lib/scheduling'

export const BULK_SCHEDULE_MAX_ITEMS = 50

export const MIN_SCHEDULE_MS = 10 * 60 * 1000
export const MAX_SCHEDULE_MS = 180 * 24 * 60 * 60 * 1000

export type BulkScheduleType = 'fixed' | 'dailyrandom'

export type BulkScheduleConfig = {
  startDate: string
  postsPerDay: number
  scheduleType: BulkScheduleType
  postingTimes: string[]
  timezone: string
}

export function ensurePostingTimesLength(times: string[], postsPerDay: number): string[] {
  const next = [...times]
  if (postsPerDay > next.length) {
    for (let i = next.length; i < postsPerDay; i++) next.push('')
  } else if (postsPerDay < next.length) {
    next.splice(postsPerDay)
  }
  return next
}

export function assertScheduleWindow(scheduledAt: Date) {
  const delta = scheduledAt.getTime() - Date.now()
  if (delta < MIN_SCHEDULE_MS) {
    throw new Error('Scheduled time must be at least 10 minutes in the future')
  }
  if (delta > MAX_SCHEDULE_MS) {
    throw new Error('Scheduled time cannot be more than 6 months in the future')
  }
}

function parseSlotTime(timeStr: string): { hours: number; minutes: number } | null {
  const trimmed = String(timeStr || '').trim()
  if (!trimmed) return null

  try {
    const twelveHour = parse(trimmed, 'hh:mm a', new Date())
    if (!Number.isNaN(twelveHour.getTime())) {
      return {
        hours: twelveHour.getHours(),
        minutes: twelveHour.getMinutes(),
      }
    }
  } catch {
    // fall through
  }

  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hours = Number.parseInt(match[1]!, 10)
  const minutes = Number.parseInt(match[2]!, 10)
  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours > 23 || minutes > 59) {
    return null
  }
  return { hours, minutes }
}

function buildZonedScheduleDate(
  startDate: string,
  dayOffset: number,
  timeStr: string,
  timezone: string,
): Date {
  const parsed = parseSlotTime(timeStr)
  if (!parsed) {
    throw new Error(`Invalid posting time: ${timeStr || '(empty)'}`)
  }

  const day = addDays(parseISO(startDate), dayOffset)
  const dateStr = format(day, 'yyyy-MM-dd')
  const localTime = `${String(parsed.hours).padStart(2, '0')}:${String(parsed.minutes).padStart(2, '0')}:00`

  return fromZonedTime(`${dateStr} ${localTime}`, timezone)
}

function getDaySlotTimes(
  scheduleType: BulkScheduleType,
  postsPerDay: number,
  postingTimes: string[],
): string[] {
  if (scheduleType === 'dailyrandom') {
    return generateBalancedPostTimes(postsPerDay)
  }
  const slots = ensurePostingTimesLength(postingTimes, postsPerDay)
  const missing = slots.find((t) => !String(t || '').trim())
  if (missing !== undefined) {
    throw new Error('All fixed posting time slots must be filled')
  }
  return slots
}

export function generateBulkScheduleTimestamps(
  itemCount: number,
  config: BulkScheduleConfig,
): string[] {
  if (!itemCount || itemCount < 1) {
    throw new Error('At least one item is required')
  }
  if (itemCount > BULK_SCHEDULE_MAX_ITEMS) {
    throw new Error(`Bulk schedule supports at most ${BULK_SCHEDULE_MAX_ITEMS} items`)
  }

  const postsPerDay = Math.min(5, Math.max(1, config.postsPerDay))
  const startDate = config.startDate?.trim()
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    throw new Error('A valid start date (YYYY-MM-DD) is required')
  }

  const timestamps: string[] = []
  const daysNeeded = Math.ceil(itemCount / postsPerDay)

  for (let dayOffset = 0; dayOffset < daysNeeded && timestamps.length < itemCount; dayOffset++) {
    const daySlots = getDaySlotTimes(config.scheduleType, postsPerDay, config.postingTimes)
    for (const slot of daySlots) {
      if (timestamps.length >= itemCount) break
      const at = buildZonedScheduleDate(startDate, dayOffset, slot, config.timezone)
      assertScheduleWindow(at)
      timestamps.push(at.toISOString())
    }
  }

  return timestamps
}
