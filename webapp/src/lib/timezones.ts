import { formatInTimeZone } from 'date-fns-tz'

export interface TimezoneOption {
  value: string
  label: string
}

export function getTimezones(): TimezoneOption[] {
  // Intl.supportedValuesOf might not be available in all environments, but it's safe in modern ones
  // We use a try-catch with a fallback if needed, but for this project we assume modern environment
  try {
    const timezones = Intl.supportedValuesOf('timeZone')
    const now = new Date()

    return timezones.map(tz => {
      try {
        const offset = formatInTimeZone(now, tz, 'xxx') // e.g. +05:00
        const abbreviation = formatInTimeZone(now, tz, 'zzz') // e.g. PKT
        return {
          value: tz,
          label: `${tz} (${abbreviation}) ${offset}`
        }
      } catch {
        return {
          value: tz,
          label: tz
        }
      }
    })
  } catch {
    return [
      { value: 'UTC', label: 'UTC (GMT) +00:00' }
    ]
  }
}

export function getStartOfTodayInTimezone(timezone: string = 'UTC'): Date {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    })
    const parts = fmt.formatToParts(new Date())
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || ''
    const month = getPart('month').padStart(2, '0')
    const day = getPart('day').padStart(2, '0')
    const year = getPart('year')

    const fmtFull = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    })
    const fullParts = fmtFull.formatToParts(new Date())
    const getFullPart = (type: string) => parseInt(fullParts.find(p => p.type === type)?.value || '0', 10)

    const tzYear = getFullPart('year')
    const tzMonth = getFullPart('month') - 1
    const tzDay = getFullPart('day')
    let tzHour = getFullPart('hour')
    if (tzHour === 24) tzHour = 0
    const tzMinute = getFullPart('minute')
    const tzSecond = getFullPart('second')

    const now = new Date()
    const utcTime = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
      now.getUTCMinutes(),
      now.getUTCSeconds()
    )

    const tzTime = Date.UTC(
      tzYear,
      tzMonth,
      tzDay,
      tzHour,
      tzMinute,
      tzSecond
    )

    const offsetMs = tzTime - utcTime

    const midnightTz = Date.UTC(
      parseInt(year, 10),
      parseInt(month, 10) - 1,
      parseInt(day, 10),
      0,
      0,
      0
    )

    return new Date(midnightTz - offsetMs)
  } catch (e) {
    const fallback = new Date()
    fallback.setUTCHours(0, 0, 0, 0)
    return fallback
  }
}
