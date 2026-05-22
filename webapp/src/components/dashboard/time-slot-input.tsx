'use client'

import { useMemo } from 'react'
import { Time } from '@internationalized/date'
import { DateInput, DateSegment, TimeField } from 'react-aria-components'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Meridiem = 'AM' | 'PM'

function parseTwelveHour(value: string): { hour: string; minute: string; meridiem: Meridiem } | null {
  const trimmed = String(value || '').trim().toUpperCase()
  const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/)
  if (!match) return null

  const hourNum = Number.parseInt(match[1], 10)
  const minuteNum = Number.parseInt(match[2], 10)
  const meridiem = match[3] as Meridiem

  if (Number.isNaN(hourNum) || Number.isNaN(minuteNum)) return null
  if (hourNum < 1 || hourNum > 12 || minuteNum < 0 || minuteNum > 59) return null

  return {
    hour: String(hourNum),
    minute: String(minuteNum).padStart(2, '0'),
    meridiem,
  }
}

export function TimeSlotInput({
  value,
  onChange,
  idPrefix,
  nextFieldId,
}: {
  value: string
  onChange: (value: string) => void
  idPrefix: string
  nextFieldId?: string
}) {
  const timeValue = useMemo(() => {
    const parsed = parseTwelveHour(value)
    if (!parsed) return null
    const hourNum = Number.parseInt(parsed.hour, 10)
    const minuteNum = Number.parseInt(parsed.minute, 10)
    if (Number.isNaN(hourNum) || Number.isNaN(minuteNum)) return null
    let h24 = hourNum % 12
    if (parsed.meridiem === 'PM') h24 += 12
    return new Time(h24, minuteNum)
  }, [value])

  return (
    <div className="grid gap-2 rounded-md border p-2">
      <div
        className="flex items-center gap-2"
        onKeyDownCapture={(e) => {
          if (e.key === 'Enter' && nextFieldId) {
            e.preventDefault()
            const nextField = document.getElementById(nextFieldId) as HTMLElement | null
            const nextSegment = nextField?.querySelector('[role="spinbutton"]') as HTMLElement | null
            ;(nextSegment || nextField)?.focus()
          }
        }}
        >
        <TimeField
          value={timeValue}
          onChange={(nextValue) => {
            if (!nextValue) {
              onChange('')
              return
            }

            const h24 = nextValue.hour
            const minute = String(nextValue.minute).padStart(2, '0')
            const meridiem: Meridiem = h24 >= 12 ? 'PM' : 'AM'
            const h12 = h24 % 12 || 12
            onChange(`${h12}:${minute} ${meridiem}`)
          }}
          granularity="minute"
          hourCycle={12}
        >
          <div id={`${idPrefix}-field`}>
            <DateInput
              className={cn(
                'flex h-9 min-w-[180px] items-center gap-1 rounded-md border border-border bg-transparent px-3 text-xs',
                'focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/20'
              )}
            >
              {(segment) => (
                <DateSegment
                  segment={segment}
                  className={cn(
                    'rounded px-1 outline-none',
                    segment.type === 'literal' ? 'text-muted-foreground px-0' : 'focus:bg-primary/10'
                  )}
                />
              )}
            </DateInput>
          </div>
        </TimeField>
        <Button
          type="button"
          variant="ghost"
          className="h-8 px-2 text-xs"
          onClick={() => onChange('')}
        >
          Clear
        </Button>
      </div>
    </div>
  )
}
