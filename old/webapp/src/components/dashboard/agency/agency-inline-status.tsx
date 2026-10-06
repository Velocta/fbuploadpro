import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function AgencyInlineStatus({
  label,
  tone = 'default',
  className,
}: {
  label: string
  tone?: 'default' | 'muted' | 'destructive'
  className?: string
}) {
  return (
    <Badge
      variant={tone === 'destructive' ? 'destructive' : tone === 'muted' ? 'secondary' : 'default'}
      className={cn('inline-flex items-center gap-1.5 text-xs capitalize', className)}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      <span>{label}</span>
    </Badge>
  )
}
