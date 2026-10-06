import { HowItWorksSectionMotion } from '@/components/landing/how-it-works-motion'

const howItWorksSteps = [
    {
        number: '01',
        title: 'Securely link your Facebook pages',
        description:
            'Log in via official Facebook authentication and select the pages you want to automate. We never ask for passwords or session cookies.',
    },
    {
        number: '02',
        title: 'Provide source accounts',
        description:
            'Add public Instagram, TikTok, YouTube, or Facebook usernames. Our system automatically scrapes, downloads, and processes their reels on our servers.',
    },
    {
        number: '03',
        title: 'Configure posting schedule',
        description: 'Define your target posting times. The system publishes reels at those exact moments automatically. No need to keep your PC on or browser open.',
    },
] as const

export function HowItWorksSection() {
    return (
        <section
            id="how-it-works"
            className="relative overflow-hidden border-y border-border bg-muted/40 py-24 sm:py-28 dark:bg-muted/20"
            aria-labelledby="how-it-works-heading"
        >
            <div className="landing-atmosphere-radials-how" aria-hidden />
            <div
                className="pointer-events-none absolute -left-16 top-1/3 h-64 w-64 rounded-full bg-primary/[0.07] blur-3xl motion-reduce:animate-none animate-pulse-slow"
                aria-hidden
            />
            <div
                className="pointer-events-none absolute -right-10 bottom-1/4 h-56 w-56 rounded-full bg-primary/[0.06] blur-3xl motion-reduce:animate-none animate-mist-drift"
                aria-hidden
            />
            <div className="landing-atmosphere-grid-section" aria-hidden />

            <HowItWorksSectionMotion steps={[...howItWorksSteps]} />
        </section>
    )
}
