import { HowItWorksSectionMotion } from '@/components/landing/how-it-works-motion'

const howItWorksSteps = [
    {
        number: '01',
        title: 'Connect your Facebook pages',
        description:
            'Link your account securely and choose the pages you want to publish to.',
    },
    {
        number: '02',
        title: 'Add source usernames',
        description:
            'Provide Instagram/TikTok/YouTube usernames or Facebook page/user IDs and we will download their reels on our server.',
    },
    {
        number: '03',
        title: 'Run automated publishing',
        description: 'Set the posting times and reels will be posted on those times.',
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
