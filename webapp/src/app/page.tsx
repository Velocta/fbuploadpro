import Link from 'next/link'
import nextDynamic from 'next/dynamic'
import { Navbar } from '@/components/landing/navbar'
import { HeroSection } from '@/components/landing/hero-section'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const HowItWorksSection = nextDynamic(() => import('@/components/landing/how-it-works').then((mod) => mod.HowItWorksSection), {
  ssr: true,
  loading: () => <div className="min-h-[400px] animate-pulse bg-muted/10" />
})

const PricingSection = nextDynamic(() => import('@/components/landing/pricing-section').then((mod) => mod.PricingSection), {
  ssr: true,
  loading: () => <div className="min-h-[500px] animate-pulse bg-muted/10" />
})

const MythbustersSection = nextDynamic(() => import('@/components/landing/mythbusters').then((mod) => mod.MythbustersSection), {
  ssr: true,
  loading: () => <div className="min-h-[400px] animate-pulse bg-muted/10" />
})

const FeaturesSection = nextDynamic(() => import('@/components/landing/features-section').then((mod) => mod.FeaturesSection), {
  ssr: true,
  loading: () => <div className="min-h-[400px] animate-pulse bg-muted/10" />
})

const FooterSection = nextDynamic(() => import('@/components/landing/footer-section').then((mod) => mod.FooterSection), {
  ssr: true,
  loading: () => <div className="min-h-[200px] animate-pulse bg-muted/10" />
})

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground selection:bg-primary/10 selection:text-primary overflow-x-hidden">
      <Link
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 z-[60] rounded-md bg-background border border-border px-3 py-2 text-sm"
      >
        Skip to main content
      </Link>
      <Navbar />

      <main id="main-content" className="relative flex-1">
        <div className="landing-page-mist" aria-hidden>
          <div className="landing-page-mist-blob-a motion-reduce:animate-none animate-pulse-slow" />
          <div className="landing-page-mist-blob-b motion-reduce:animate-none animate-mist-drift" />
          <div className="landing-page-mist-blob-c" />
        </div>
        <HeroSection />
        <PricingSection />
        <HowItWorksSection />
        <MythbustersSection />
        <FeaturesSection />
      </main>

      <FooterSection />
    </div>
  )
}
