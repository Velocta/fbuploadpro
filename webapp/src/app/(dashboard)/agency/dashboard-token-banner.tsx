'use client'

import { AlertTriangle, Coins } from 'lucide-react'
import { AddTokensDialog } from './add-tokens-dialog'
import { Button } from '@/components/ui/button'
import type { TokenBalanceTier } from './dashboard-overview-utils'
import { cn } from '@/lib/utils'
import { useBrand } from '@/components/brand-provider'

export function DashboardTokenBanner({
  tier,
  tokensBalance,
}: {
  tier: Extract<TokenBalanceTier, 'zero' | 'low'>
  tokensBalance: number
}) {
  const brand = useBrand()

  if (tier === 'zero') {
    return (
      <section
        className={cn(
          'rounded-2xl border p-5',
          'border-destructive/30 bg-destructive/5',
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Token balance is 0
            </p>
            <p className="text-sm text-foreground">
              Automation is paused. Contact your tool owner to add or upgrade your token balance.
              Facebook features in the sidebar stay locked until tokens are added.
            </p>
          </div>
          {!brand.hideAddTokens && (
            <AddTokensDialog
              trigger={
                <Button className="shrink-0 gap-2 rounded-xl">
                  <Coins className="h-4 w-4" />
                  Add tokens
                </Button>
              }
            />
          )}
        </div>
      </section>
    )
  }

  return (
    <section
      className={cn(
        'rounded-2xl border p-5',
        'border-amber-500/30 bg-amber-500/5',
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Low token balance
          </p>
          <p className="text-sm text-foreground">
            You have <span className="font-semibold tabular-nums">{tokensBalance.toLocaleString()}</span>{' '}
            tokens left (under 1,000). Contact your tool owner to upgrade your plan before automation
            stops.
          </p>
        </div>
        {!brand.hideAddTokens && (
          <AddTokensDialog
            trigger={
              <Button variant="outline" className="shrink-0 gap-2 rounded-xl border-amber-500/40">
                <Coins className="h-4 w-4" />
                Add or upgrade tokens
              </Button>
            }
          />
        )}
      </div>
    </section>
  )
}
