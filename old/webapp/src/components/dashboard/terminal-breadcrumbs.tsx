'use client'

import * as React from 'react'
import Link from 'next/link'
import { Terminal, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BreadcrumbSegment {
  label: string
  href?: string
}

interface TerminalBreadcrumbsProps {
  segments: BreadcrumbSegment[]
  className?: string
}

export function TerminalBreadcrumbs({ segments, className }: TerminalBreadcrumbsProps) {
  return (
    <div
      className={cn(
        'flex w-fit items-center space-x-3 rounded-xl border border-border bg-secondary/50 px-4 py-3 font-mono text-xs font-semibold uppercase tracking-wide text-muted-foreground',
        className,
      )}
    >
      <Terminal className="h-3.5 w-3.5 text-primary" />
      {segments.map((segment, index) => (
        <React.Fragment key={index}>
          {index > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/50" />}
          {segment.href ? (
            <Link
              href={segment.href}
              className="rounded-sm transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {segment.label}
            </Link>
          ) : (
            <span className="text-foreground">
              {segment.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </div>
  )
}
