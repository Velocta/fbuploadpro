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
import { ScrollArea } from '@/components/ui/scroll-area'
import { getTimezones } from '@/lib/timezones'

interface TimezoneSelectProps {
  value: string
  onValueChange: (value: string) => void
  name?: string
}

export function TimezoneSelect({ value, onValueChange, name }: TimezoneSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const timezones = useMemo(() => getTimezones(), [])

  const filteredTimezones = useMemo(() => {
    if (!search) return timezones
    const lowerSearch = search.toLowerCase()
    return timezones.filter((tz) =>
      tz.label.toLowerCase().includes(lowerSearch) ||
      tz.value.toLowerCase().includes(lowerSearch)
    )
  }, [search, timezones])

  const selectedTimezone = timezones.find((tz) => tz.value === value)

  return (
    <div className="relative w-full">
      <input type="hidden" name={name} value={value} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-9 text-xs font-normal"
          >
            <span className="truncate">
              {selectedTimezone ? selectedTimezone.label : "Select timezone..."}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              placeholder="Search timezone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none border-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <ScrollArea className="h-72">
            <div className="p-1">
              {filteredTimezones.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No timezone found.
                </div>
              ) : (
                filteredTimezones.map((tz) => (
                  <div
                    key={tz.value}
                    className={cn(
                      "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                      value === tz.value && "bg-accent text-accent-foreground"
                    )}
                    onClick={() => {
                      onValueChange(tz.value)
                      setOpen(false)
                      setSearch('')
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === tz.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {tz.label}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  )
}
