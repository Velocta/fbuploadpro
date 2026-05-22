import * as React from 'react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function AuthFormCard({
  className,
  ...props
}: React.ComponentProps<typeof Card>) {
  return (
    <div
      className={cn(
        'w-full animate-in fade-in slide-in-from-bottom-1 duration-200 motion-reduce:animate-none',
      )}
    >
      <Card className={cn('auth-card-surface relative', className)} {...props} />
    </div>
  )
}
