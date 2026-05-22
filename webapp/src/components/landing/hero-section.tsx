import { HeroSectionMotion } from '@/components/landing/hero-section-motion'
import { HeroPointerAmbient } from '@/components/landing/hero-pointer-ambient'

export function HeroSection() {
    return (
        <section
            data-hero-ambient-root
            className="relative flex min-h-dvh flex-col overflow-hidden bg-background font-sans"
        >
            <div className="landing-atmosphere-radials-hero" aria-hidden="true" />
            <div className="landing-hero-veil-a motion-reduce:animate-none" aria-hidden="true" />
            <div className="landing-hero-veil-b motion-reduce:animate-none" aria-hidden="true" />
            <div
                className="absolute -top-32 -left-20 h-80 w-80 rounded-full bg-primary/10 blur-3xl motion-reduce:animate-none animate-pulse-slow"
                aria-hidden="true"
            />
            <div
                className="animate-mist-drift absolute top-28 right-0 h-72 w-72 rounded-full bg-primary/[0.07] blur-3xl motion-reduce:animate-none"
                aria-hidden="true"
            />
            <div className="landing-atmosphere-grid-hero" aria-hidden="true" />
            <div className="landing-hero-sheen motion-reduce:animate-none" aria-hidden="true" />
            <div className="landing-hero-grain" aria-hidden="true" />
            <HeroPointerAmbient />

            <div className="relative flex flex-1 flex-col justify-center px-4 pt-24 pb-12 sm:px-6 sm:pt-28 lg:px-8 lg:pt-32 lg:pb-16">
                <HeroSectionMotion />
            </div>
        </section>
    )
}
