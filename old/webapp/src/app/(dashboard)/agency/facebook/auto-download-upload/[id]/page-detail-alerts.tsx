import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { getAduPageStatusAlert, type AduPageStatusInput } from '@/lib/adu-page-detail-status'
import { cn } from '@/lib/utils'

import { AduStatusIcon } from './adu-status-icon'

export function PageDetailAlerts({ profile }: { profile: AduPageStatusInput }) {
  const alert = getAduPageStatusAlert(profile)
  if (!alert) return null

  const isDestructive = alert.variant === 'destructive'

  return (
    <Alert
      variant={alert.variant}
      className={cn(
        'rounded-2xl border border-border/50 bg-card/40 shadow-lg backdrop-blur-xl',
        isDestructive && 'border-destructive/20 bg-destructive/10 text-destructive',
      )}
    >
      {alert.iconKind !== 'none' ? <AduStatusIcon kind={alert.iconKind} className="h-4 w-4" /> : null}
      <AlertTitle className={cn('font-bold', isDestructive && 'text-destructive')}>{alert.title}</AlertTitle>
      <AlertDescription className={cn(isDestructive && 'text-destructive/90')}>
        <p>{alert.description}</p>
      </AlertDescription>
    </Alert>
  )
}
