const HHMM_REGEX = /^([01][0-9]|2[0-3]):[0-5][0-9]$/
const SIGNED_HHMM_REGEX = /^[-+]?\d{1,3}:[-+]?\d{1,3}$/

function minutesToHHMM(totalMinutes: number): string {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440
  const hours = Math.floor(wrapped / 60).toString().padStart(2, '0')
  const minutes = (wrapped % 60).toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

export function sanitizeToUtcHHMM(value: string, fallback = '08:00'): string {
  const raw = String(value || '').trim()
  if (HHMM_REGEX.test(raw)) return raw

  if (SIGNED_HHMM_REGEX.test(raw)) {
    const [hhRaw, mmRaw] = raw.split(':')
    const hh = Number.parseInt(hhRaw, 10)
    const mm = Number.parseInt(mmRaw, 10)
    if (!Number.isNaN(hh) && !Number.isNaN(mm)) {
      return minutesToHHMM(hh * 60 + mm)
    }
  }

  return HHMM_REGEX.test(fallback) ? fallback : '08:00'
}
