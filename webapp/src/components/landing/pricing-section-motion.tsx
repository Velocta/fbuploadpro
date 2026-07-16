'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Coins, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import dynamic from 'next/dynamic'
import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'

const MonthlyPriceCalculatorSection = dynamic(
  () => import('@/components/landing/monthly-price-calculator-section').then((mod) => mod.MonthlyPriceCalculatorSection),
  {
    ssr: true,
    loading: () => <div className="min-h-[300px] animate-pulse bg-muted/10 rounded-xl" />
  }
)

export function PricingSectionMotion() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null)

  const handleNavigation = (href: string) => {
    setNavigatingTo(href)
    startTransition(() => {
      router.push(href)
    })
  }

  return (
    <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mx-auto mb-12 max-w-3xl text-center">
        <Badge
          variant="outline"
          className="mb-4 px-4 py-1 text-xs font-semibold uppercase tracking-[0.12em] border-primary/20 bg-primary/5 text-primary"
        >
          Simple Pricing
        </Badge>
        <h2 id="pricing-heading" className="mb-6 text-3xl font-bold tracking-tight md:text-5xl">
          Pay as you grow with
          <span className="text-primary"> no fixed plan lock-in.</span>
        </h2>
        <p className="text-lg leading-relaxed text-muted-foreground">
          Our dynamic pricing model means you only pay for what you use. Top up your account with tokens and
          distribute content across your entire agency portfolio.
        </p>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-10 xl:gap-12">
        <div>
          <div className="relative overflow-hidden rounded-xl">
            <span className="marketing-card-conic-glow motion-reduce:animate-none" aria-hidden />
            <Card className="relative z-10 m-px overflow-hidden rounded-[calc(0.75rem-1px)] border border-border bg-muted/20 shadow-none transition-shadow duration-200 ease-out motion-reduce:transition-none hover:shadow-md hover:ring-1 hover:ring-primary/10 motion-reduce:hover:shadow-none motion-reduce:hover:ring-0">
              <CardContent className="space-y-8 p-6 sm:p-8">
                <div className="space-y-4">
                  <h3 className="group flex items-center gap-3 text-2xl font-bold">
                    <span className="inline-flex rounded-lg bg-primary/5 p-2 transition-transform duration-200 ease-out motion-reduce:transition-none group-hover:scale-[1.02] motion-reduce:group-hover:scale-100">
                       <Coins className="h-5 w-5 text-primary" />
                    </span>
                    Unified Token System
                  </h3>
                  <ul className="space-y-4 text-sm text-muted-foreground">
                    {[
                      'Top up whatever amount you need - buy tokens starting from as low as 100 PKR.',
                      'Non-expiring tokens - use them whenever you need.',
                      'Only pay for successfully published reels - failed scrapes or posting errors do not consume tokens.',
                      '100% Free core features - account linking, direct scheduling, In-App queue scheduling, and bulk deleting posts cost zero tokens.',
                      'Direct founder support via WhatsApp.',
                    ].map((feature, i) => (
                      <li key={i} className="group/feat flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary transition-transform duration-200 ease-out group-hover/feat:scale-[1.02] motion-reduce:group-hover/feat:scale-100" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-6 rounded-xl border border-border bg-background p-6 shadow-sm">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Free account creation</p>
                    <h4 className="text-2xl font-bold sm:text-3xl">Start Free Now</h4>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Create an account to start adding Facebook pages. You aren&apos;t charged for linking accounts, editing page schedules, or queueing your own posts.
                  </p>
                  <Button
                    className="h-12 w-full rounded-lg text-sm font-semibold shadow-sm transition-[background-color,box-shadow,transform] duration-200 ease-out hover:bg-primary/90 motion-reduce:active:scale-100 active:scale-[0.98]"
                    loading={isPending && navigatingTo === '/signup'}
                    onClick={() => handleNavigation('/signup')}
                  >
                    Sign Up Now
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div>
          <MonthlyPriceCalculatorSection layout="split" />
        </div>
      </div>
    </div>
  )
}
