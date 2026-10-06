'use client'

import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function HubActionPendingOverlay({
  show,
  className,
  message = 'Loading…',
}: {
  show: boolean
  className?: string
  message?: string
}) {
  if (!show) return null

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-background/55 backdrop-blur-[2px]',
        className,
      )}
      aria-hidden
    >
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="text-xs font-medium text-muted-foreground">{message}</span>
      </div>
    </div>
  )
}
