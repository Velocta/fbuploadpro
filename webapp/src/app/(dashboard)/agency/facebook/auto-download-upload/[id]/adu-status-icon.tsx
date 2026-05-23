import {
  AlertCircle,
  CheckCircle2,
  Clock,
  KeyRound,
  RefreshCcw,
  ShieldAlert,
  UserX,
} from 'lucide-react'
import type { AduStatusIconKind } from '@/lib/adu-page-detail-status'
import { cn } from '@/lib/utils'

export function AduStatusIcon({
  kind,
  className,
}: {
  kind: AduStatusIconKind
  className?: string
}) {
  const iconClass = cn('h-3.5 w-3.5 shrink-0', className)

  switch (kind) {
    case 'alert-circle':
      return <AlertCircle className={iconClass} />
    case 'refresh':
      return <RefreshCcw className={cn(iconClass, 'animate-spin')} />
    case 'clock':
      return <Clock className={iconClass} />
    case 'check':
      return <CheckCircle2 className={cn(iconClass, 'text-primary')} />
    case 'shield':
      return <ShieldAlert className={iconClass} />
    case 'key':
      return <KeyRound className={iconClass} />
    case 'user-x':
      return <UserX className={iconClass} />
    case 'pulse':
      return <span className={cn('flex h-1.5 w-1.5 rounded-full bg-primary-foreground', className)} />
    case 'none':
    default:
      return null
  }
}
