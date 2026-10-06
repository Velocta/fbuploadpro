import type { ComponentProps } from 'react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function AgencySectionCard({
  className,
  ...props
}: ComponentProps<typeof Card>) {
  return (
    <Card
      className={cn(
        'agency-surface-card transition-[border-color,box-shadow,background-color] duration-200 ease-out',
        className,
      )}
      {...props}
    />
  )
}
