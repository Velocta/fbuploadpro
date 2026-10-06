'use client'

import { useState, useMemo } from 'react'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { getTimezones } from '@/lib/timezones'

interface TimezoneSelectProps {
  value: string
  onValueChange: (value: string) => void
  name?: string
  className?: string
  triggerClassName?: string
}

export function TimezoneSelect({
  value,
  onValueChange,
  name,
  className,
  triggerClassName,
}: TimezoneSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const timezones = useMemo(() => getTimezones(), [])

  const filteredTimezones = useMemo(() => {
    if (!search) return timezones
    const lowerSearch = search.toLowerCase()
    return timezones.filter(
      (tz) =>
        tz.label.toLowerCase().includes(lowerSearch) ||
        tz.value.toLowerCase().includes(lowerSearch),
    )
  }, [search, timezones])

  const selectedTimezone = timezones.find((tz) => tz.value === value)

  return (
    <div className={cn('relative w-full', className)}>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'h-12 w-full justify-between rounded-xl border-border/50 bg-background/50 text-sm font-normal',
              triggerClassName,
            )}
          >
            <span className="truncate text-left">
              {selectedTimezone ? selectedTimezone.label : 'Select timezone…'}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="z-[250] w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex items-center border-b border-border/50 px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              placeholder="Search timezone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 flex-1 rounded-none border-0 bg-transparent py-2 text-sm shadow-none focus-visible:ring-0"
            />
          </div>
          <div
            className="max-h-[min(16rem,45vh)] overflow-y-auto overscroll-contain p-1"
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            {filteredTimezones.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No timezone found.
              </div>
            ) : (
              filteredTimezones.map((tz) => (
                <button
                  key={tz.value}
                  type="button"
                  className={cn(
                    'relative flex w-full cursor-default select-none items-center rounded-lg px-2 py-2 text-left text-xs outline-none transition-colors hover:bg-muted/60',
                    value === tz.value && 'bg-primary/10 text-primary',
                  )}
                  onClick={() => {
                    onValueChange(tz.value)
                    setOpen(false)
                    setSearch('')
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4 shrink-0',
                      value === tz.value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <span className="truncate">{tz.label}</span>
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
