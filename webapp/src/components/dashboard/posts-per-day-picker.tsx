'use client'

import { cn } from '@/lib/utils'

const POSTS_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const

interface PostsPerDayPickerProps {
  value: number
  onValueChange: (value: string) => void
  name?: string
  className?: string
}

export function PostsPerDayPicker({
  value,
  onValueChange,
  name,
  className,
}: PostsPerDayPickerProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {name ? <input type="hidden" name={name} value={String(value)} /> : null}
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {POSTS_OPTIONS.map((n) => {
          const selected = value === n
          return (
            <button
              key={n}
              type="button"
              onClick={() => onValueChange(String(n))}
              className={cn(
                'flex h-11 flex-col items-center justify-center rounded-xl border text-sm font-semibold transition-all',
                selected
                  ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/25 shadow-sm'
                  : 'border-border/50 bg-background/50 text-muted-foreground hover:border-primary/30 hover:bg-muted/40 hover:text-foreground',
              )}
            >
              <span className="text-lg leading-none">{n}</span>
              <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide opacity-80">
                {n === 1 ? 'post' : 'posts'}
              </span>
            </button>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Selected: <span className="font-semibold text-foreground">{value}</span> post
        {value === 1 ? '' : 's'} per day
      </p>
    </div>
  )
}
