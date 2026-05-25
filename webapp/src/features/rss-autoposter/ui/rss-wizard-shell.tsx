'use client'

import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export const RSS_WIZARD_TOTAL_STEPS = 5

export function rssWizardStepSubtitle(step: number): string {
  switch (step) {
    case 1:
      return 'Facebook Page'
    case 2:
      return 'RSS Feed'
    case 3:
      return 'Schedule'
    case 4:
      return 'Template'
    case 5:
      return 'Confirm'
    default:
      return ''
  }
}

export function WizardStepProgress({ step, total = RSS_WIZARD_TOTAL_STEPS }: { step: number; total?: number }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: total }, (_, i) => i + 1).map((s) => (
        <div
          key={s}
          className={cn(
            'h-1.5 flex-1 rounded-full transition-all',
            s <= step ? 'bg-primary' : 'bg-muted',
          )}
        />
      ))}
    </div>
  )
}

export function WizardLoadingPanel({
  message,
  submessage,
}: {
  message: string
  submessage?: string
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 px-6 py-10">
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-blue-500/10"
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
        aria-hidden
      />
      <div className="relative flex flex-col items-center gap-4 text-center">
        <div className="relative flex h-14 w-14 items-center justify-center">
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-primary/20"
            animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
          />
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{message}</p>
          {submessage ? <p className="text-xs text-muted-foreground">{submessage}</p> : null}
        </div>
      </div>
    </div>
  )
}

export function WizardInlineError({
  message,
  onDismiss,
  onRetry,
}: {
  message: string
  onDismiss?: () => void
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <p>{message}</p>
      <div className="flex flex-wrap gap-2">
        {onRetry ? (
          <button
            type="button"
            className="font-medium underline underline-offset-2 hover:no-underline"
            onClick={onRetry}
          >
            Try again
          </button>
        ) : null}
        {onDismiss ? (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={onDismiss}
          >
            Dismiss
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function WizardGlassPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-border/50 bg-card/40 p-4 backdrop-blur-sm', className)}>
      {children}
    </div>
  )
}
