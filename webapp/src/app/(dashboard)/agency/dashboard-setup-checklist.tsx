'use client'

import Link from 'next/link'
import { CheckCircle2, Circle } from 'lucide-react'
import { AgencySectionCard } from '@/components/dashboard/agency'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ADD_TOKENS_HREF } from '@/components/dashboard/nav-config'
import { cn } from '@/lib/utils'
import type { TokenBalanceTier } from './dashboard-overview-utils'

type Step = {
  id: string
  label: string
  done: boolean
  href: string
  hidden?: boolean
}

export function DashboardSetupChecklist({
  tokenTier,
  hasFacebookApp,
  fbAccountsCount,
  totalPages,
}: {
  tokenTier: TokenBalanceTier
  hasFacebookApp: boolean
  fbAccountsCount: number
  totalPages: number
}) {
  const hasTokens = tokenTier !== 'zero'
  const steps: Step[] = [
    {
      id: 'tokens',
      label:
        tokenTier === 'zero'
          ? 'Add tokens — contact your tool owner'
          : tokenTier === 'low'
            ? 'Add or upgrade tokens (balance under 1,000)'
            : 'Token balance ready',
      done: hasTokens,
      href: ADD_TOKENS_HREF,
    },
    {
      id: 'byoc',
      label: 'Connect Facebook app (BYOC)',
      done: hasFacebookApp,
      href: '/agency/settings/facebook-byoc',
      hidden: !hasTokens,
    },
    {
      id: 'fb-account',
      label: 'Add a Facebook account',
      done: fbAccountsCount > 0,
      href: '/agency/facebook/accounts',
      hidden: !hasTokens,
    },
    {
      id: 'adu-page',
      label: 'Add your first ADU page',
      done: totalPages > 0,
      href: '/agency/facebook/auto-download-upload',
      hidden: !hasTokens,
    },
  ]

  const visibleSteps = steps.filter((s) => !s.hidden)
  const allDone = visibleSteps.every((s) => s.done)
  const showCard = (totalPages === 0 || fbAccountsCount === 0) && !allDone

  if (!showCard) return null

  return (
    <AgencySectionCard className="border-primary/15">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-wide text-primary/90">
          Get started
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        <ul className="space-y-2">
          {visibleSteps.map((step) => (
            <li key={step.id}>
              <Link
                href={step.done ? '#' : step.href}
                onClick={(e) => step.done && e.preventDefault()}
                className={cn(
                  'flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2.5 text-sm transition-colors',
                  !step.done && 'hover:border-primary/30 hover:bg-background/40',
                  step.done && 'cursor-default opacity-80',
                )}
              >
                {step.done ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className={cn('flex-1', step.done && 'text-muted-foreground line-through')}>
                  {step.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </AgencySectionCard>
  )
}
