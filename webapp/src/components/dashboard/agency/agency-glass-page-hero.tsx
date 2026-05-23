import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type AgencyBreadcrumbSegment = {
  label: string
  href?: string
}

export function AgencyGlassPageHero({
  segments,
  title,
  description,
  actions,
  icon,
  leading,
  children,
  className,
}: {
  segments?: AgencyBreadcrumbSegment[]
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  icon?: ReactNode
  leading?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('relative group', className)}>
      <div
        className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 to-blue-500/20 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100"
        aria-hidden
      />
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/40 p-6 shadow-2xl backdrop-blur-xl">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-blue-500/5"
          aria-hidden
        />

        <div className="relative">
          {segments && segments.length > 0 ? (
            <nav
              aria-label="Breadcrumb"
              className="mb-5 flex flex-wrap items-center gap-1.5 text-xs font-medium"
            >
              {segments.map((segment, index) => (
                <span key={`${segment.label}-${index}`} className="flex items-center gap-1.5">
                  {index > 0 ? (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                  ) : null}
                  {segment.href ? (
                    <Link
                      href={segment.href}
                      className="rounded-sm text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      {segment.label}
                    </Link>
                  ) : (
                    <span className="text-foreground">{segment.label}</span>
                  )}
                </span>
              ))}
            </nav>
          ) : null}

          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-4">
              {leading ? (
                <div className="shrink-0">{leading}</div>
              ) : icon ? (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                  {icon}
                </div>
              ) : null}
              <div className="min-w-0 flex-1 space-y-1.5">
                <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  {title}
                </h1>
                {description ? (
                  <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                ) : null}
                {children}
              </div>
            </div>
            {actions ? (
              <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
