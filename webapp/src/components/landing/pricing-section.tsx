import { PricingSectionMotion } from '@/components/landing/pricing-section-motion'

export function PricingSection() {
  return (
    <section
      id="pricing"
      className="relative overflow-hidden border-t border-border bg-secondary/35 py-20 sm:py-24 dark:bg-secondary/25"
      aria-labelledby="pricing-heading"
    >
      <div className="landing-atmosphere-radials-pricing" aria-hidden />
      <div
        className="pointer-events-none absolute -left-14 top-1/4 h-60 w-60 rounded-full bg-primary/[0.07] blur-3xl motion-reduce:animate-none animate-pulse-slow"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-12 bottom-1/3 h-52 w-52 rounded-full bg-primary/[0.06] blur-3xl motion-reduce:animate-none animate-mist-drift"
        aria-hidden
      />
      <div className="landing-atmosphere-grid-section" aria-hidden />

      <PricingSectionMotion />
    </section>
  )
}
