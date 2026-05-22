import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

import { cn } from '@/lib/utils'

export function AuthBackLink({
  href,
  children,
  className,
}: {
  href: string
  children: ReactNode
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex min-h-11 items-center rounded-md px-2 py-2 text-sm font-medium text-muted-foreground transition-colors duration-200',
        'hover:text-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className,
      )}
    >
      <ChevronLeft className="mr-1 size-5 shrink-0 opacity-70" aria-hidden />
      {children}
    </Link>
  )
}
