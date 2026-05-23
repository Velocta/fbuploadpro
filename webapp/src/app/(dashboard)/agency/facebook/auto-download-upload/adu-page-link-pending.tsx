'use client'

import { useLinkStatus } from 'next/link'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function AduPageLinkPendingOverlay({ className }: { className?: string }) {
  const { pending } = useLinkStatus()

  if (!pending) return null

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
        <span className="text-xs font-medium text-muted-foreground">Opening page…</span>
      </div>
    </div>
  )
}
