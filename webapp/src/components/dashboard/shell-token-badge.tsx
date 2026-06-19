'use client'

import { Coins } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { AddTokensDialog } from '@/app/(dashboard)/agency/add-tokens-dialog'
import { deriveTokenBalanceTier } from '@/app/(dashboard)/agency/dashboard-overview-utils'
import { cn } from '@/lib/utils'
import { useBrand } from '@/components/brand-provider'

export function ShellTokenBadge({ tokensBalance }: { tokensBalance: number }) {
  const tier = deriveTokenBalanceTier(tokensBalance)
  const brand = useBrand()

  const badgeContent = (
    <Badge
      variant="outline"
      className={cn(
        'tabular-nums transition-colors',
        !brand.hideAddTokens && 'cursor-pointer hover:bg-muted/50',
        tier === 'ok' && 'border-primary/20 text-primary',
        tier === 'low' && 'border-amber-500/40 text-amber-700 dark:text-amber-400',
        tier === 'zero' && 'border-destructive/30 text-destructive',
      )}
    >
      <Coins className="mr-1 size-3 shrink-0" />
      <span className="truncate">{tokensBalance.toLocaleString()}</span>
    </Badge>
  )

  if (brand.hideAddTokens) {
    return (
      <div
        title="Token balance"
        className="shrink-0 rounded-md focus-visible:outline-none"
      >
        {badgeContent}
      </div>
    )
  }

  return (
    <AddTokensDialog
      trigger={
        <button
          type="button"
          title="Token balance — click to add tokens"
          className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {badgeContent}
        </button>
      }
    />
  )
}
