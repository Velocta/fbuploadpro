import { addMonths, addYears, differenceInDays, differenceInMonths, differenceInYears, format } from 'date-fns'

export function formatPageAddedDate(createdAt: string | null | undefined): string {
  if (!createdAt) return 'Unknown date'

  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return 'Unknown date'

  return format(date, 'd MMMM yyyy')
}

export function formatPageAge(createdAt: string | null | undefined): string {
  if (!createdAt) return 'Unknown age'

  const created = new Date(createdAt)
  if (Number.isNaN(created.getTime())) return 'Unknown age'

  const now = new Date()
  if (created > now) return 'Just added'

  const years = differenceInYears(now, created)
  const afterYears = addYears(created, years)
  const months = differenceInMonths(now, afterYears)
  const afterMonths = addMonths(afterYears, months)
  const days = differenceInDays(now, afterMonths)

  const parts: string[] = []
  if (years > 0) parts.push(`${years} year${years === 1 ? '' : 's'}`)
  if (months > 0) parts.push(`${months} month${months === 1 ? '' : 's'}`)
  if (days > 0) parts.push(`${days} day${days === 1 ? '' : 's'}`)

  return parts.length > 0 ? parts.slice(0, 2).join(' ') : 'Today'
}
