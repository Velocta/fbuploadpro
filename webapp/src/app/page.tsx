import Link from 'next/link'
import { Navbar } from '@/components/landing/navbar'
import { PricingSection } from '@/components/landing/pricing-section'
import { HeroSection } from '@/components/landing/hero-section'
import { HowItWorksSection } from '@/components/landing/how-it-works'
import { FooterSection } from '@/components/landing/footer-section'

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
        <HowItWorksSection />
        <PricingSection />
      </main>

      <FooterSection />
    </div>
  )
}
