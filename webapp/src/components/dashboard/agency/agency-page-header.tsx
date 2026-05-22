import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function AgencyPageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode
  description: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 border-b border-border/70 pb-6 md:flex-row md:items-end md:justify-between',
        className,
      )}
    >
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  )
}
