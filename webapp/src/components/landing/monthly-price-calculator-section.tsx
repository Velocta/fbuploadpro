'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

type SourcePlatform = 'instagram' | 'tiktok' | 'youtube' | 'facebook'

export type MonthlyPriceCalculatorLayout = 'default' | 'split'

const TOKEN_PRICE_PKR = 0.15
const DAYS_PER_MONTH = 30

const TOKENS_PER_REEL: Record<SourcePlatform, number> = {
  instagram: 1,
  tiktok: 1,
  youtube: 1,
  facebook: 1,
}

function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 2,
  }).format(amount)
}

type MonthlyPriceCalculatorSectionProps = {
  layout?: MonthlyPriceCalculatorLayout
}

export function MonthlyPriceCalculatorSection({ layout = 'default' }: MonthlyPriceCalculatorSectionProps) {
  const [source, setSource] = useState<SourcePlatform>('instagram')
  const [reelsPerDayInput, setReelsPerDayInput] = useState('2')
  const [pagesInput, setPagesInput] = useState('10')

  const reelsPerDay = parsePositiveInt(reelsPerDayInput)
  const pages = parsePositiveInt(pagesInput)
  const tokensPerReel = TOKENS_PER_REEL[source]

  const calculated = useMemo(() => {
    const monthlyReelsPerPage = reelsPerDay * DAYS_PER_MONTH
    const totalMonthlyReels = monthlyReelsPerPage * pages
    const totalMonthlyTokens = totalMonthlyReels * tokensPerReel
    const monthlyPrice = totalMonthlyTokens * TOKEN_PRICE_PKR

    return {
      monthlyReelsPerPage,
      totalMonthlyReels,
      totalMonthlyTokens,
      monthlyPrice,
    }
  }, [pages, reelsPerDay, tokensPerReel])

  const isSplit = layout === 'split'

  return (
    <div
      id="monthly-calculator"
      className={cn(isSplit ? 'mt-0 w-full' : 'mx-auto mt-12 max-w-4xl')}
    >
      <div
        className={cn(
          'mb-8',
          isSplit
            ? 'mx-0 mb-6 max-w-none text-center lg:text-left'
            : 'mx-auto max-w-3xl text-center',
        )}
      >
        <Badge variant="outline" className="mb-4 px-4 py-1 text-xs font-semibold uppercase tracking-[0.12em] border-primary/20 bg-primary/5 text-primary">
          Monthly Cost Calculator
        </Badge>
        <h3 className="text-2xl md:text-4xl font-bold tracking-tight mb-4 text-foreground">
          Estimate your monthly automation cost
        </h3>
        <p className="text-muted-foreground text-base md:text-lg leading-relaxed">
          Select a source platform, set daily reels and page count, and get an instant monthly estimate.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-xl">
        <span className="marketing-card-conic-glow motion-reduce:animate-none" aria-hidden />
        <Card
          className={cn(
            'relative z-10 m-px rounded-[calc(0.75rem-1px)] border border-border bg-muted/20 shadow-none transition-shadow duration-200 ease-out motion-reduce:transition-none',
            'hover:shadow-md hover:ring-1 hover:ring-primary/10 motion-reduce:hover:shadow-none motion-reduce:hover:ring-0',
          )}
        >
          <CardContent className={cn(isSplit ? 'p-6 md:p-8' : 'p-8 md:p-12')}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="source-platform">Source platform</Label>
                <Select value={source} onValueChange={(value) => setSource(value as SourcePlatform)}>
                  <SelectTrigger id="source-platform" className="w-full bg-background">
                    <SelectValue placeholder="Choose source platform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instagram">Instagram (1 token per reel)</SelectItem>
                    <SelectItem value="tiktok">TikTok (1 token per reel)</SelectItem>
                    <SelectItem value="youtube">YouTube (1 token per reel)</SelectItem>
                    <SelectItem value="facebook">Facebook (1 token per reel)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reels-per-day">Reels per day (per page)</Label>
                <Input
                  id="reels-per-day"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={reelsPerDayInput}
                  onChange={(event) => setReelsPerDayInput(event.target.value)}
                  className="bg-background"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pages-count">Number of pages</Label>
                <Input
                  id="pages-count"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={pagesInput}
                  onChange={(event) => setPagesInput(event.target.value)}
                  className="bg-background"
                />
              </div>

              <p id="calculator-assumptions" className="text-xs text-muted-foreground">
                Assumptions: 30 days/month, all platforms use 1 token per reel, and each token costs PKR 0.15.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-background p-6 md:p-8 space-y-4" role="status" aria-live="polite" aria-describedby="calculator-assumptions">
              <h4 className="text-xl font-semibold text-foreground">Estimated monthly total</h4>
              <p className="text-4xl font-display font-bold text-primary">
                {formatCurrency(calculated.monthlyPrice)}
              </p>

              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Monthly reels per page: <span className="font-semibold text-foreground">{calculated.monthlyReelsPerPage.toLocaleString()}</span></p>
                <p>Total monthly reels: <span className="font-semibold text-foreground">{calculated.totalMonthlyReels.toLocaleString()}</span></p>
                <p>Token rate for selected source: <span className="font-semibold text-foreground">{tokensPerReel}</span> token(s)/reel</p>
                <p>Total monthly tokens: <span className="font-semibold text-foreground">{calculated.totalMonthlyTokens.toLocaleString()}</span></p>
              </div>
            </div>
          </div>
        </CardContent>
        </Card>
      </div>
    </div>
  )
}
