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
