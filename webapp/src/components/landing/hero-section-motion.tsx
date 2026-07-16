'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    ArrowRight,
    ShieldCheck,
    ServerCog,
} from 'lucide-react'

interface HeroSectionMotionProps {
    totalFollowersGained: number
    totalUsers: number
}

export function HeroSectionMotion({ totalFollowersGained, totalUsers }: HeroSectionMotionProps) {
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
        <div className="container mx-auto">
            <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-8 md:grid-cols-[1.1fr_0.9fr] lg:gap-12">
                <div className="max-w-2xl md:pr-2">
                    <div className="mb-7">
                        <Badge
                            variant="outline"
                            className="border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold tracking-normal text-primary"
                        >
                            Unbeatable Value: Automating 1 page at 2 posts a day for a whole month costs only PKR 9.00! (10 pages = 90 PKR)
                        </Badge>
                    </div>

                    <h1 className="font-display text-display-md sm:text-display-lg lg:text-display-xl mb-6 text-left font-bold tracking-tight text-balance text-foreground">
                        Automate your Facebook pages
                        <span className="text-primary">
                            {' '}
                            100% in the cloud.
                        </span>
                    </h1>

                    <p className="text-body-lg mb-8 max-w-xl text-left text-muted-foreground">
                        Link unlimited pages securely using official Facebook APIs—no passwords or cookies required. Video downloading, caption scraping, and publishing run 24/7 on our premium residential proxies.
                    </p>

                    <div className="flex flex-col items-start gap-3 sm:flex-row sm:gap-4">
                        <Button
                            size="lg"
                            className="h-12 rounded-full px-8 text-base font-semibold shadow-sm transition-all duration-200 ease-out hover:bg-primary/90 hover:shadow-md active:scale-[0.98] active:shadow-sm"
                            asChild
                        >
                            <Link href="#pricing" className="group">
                                View Pricing
                                <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
                            </Link>
                        </Button>
                        <Button
                            size="lg"
                            variant="ghost"
                            className="h-12 rounded-full px-8 text-base font-semibold ring-0 transition-all duration-200 ease-out hover:bg-muted/80 hover:shadow-sm hover:ring-1 hover:ring-border active:scale-[0.98]"
                            loading={isPending && navigatingTo === '/signup'}
                            onClick={() => handleNavigation('/signup')}
                        >
                            Sign up
                            <ArrowRight className="ml-2 h-4 w-4 text-primary transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
                        </Button>
                    </div>

                    <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/90 px-3 py-1.5">
                            <ShieldCheck className="h-4 w-4 text-primary" />
                            No credit card required • Link unlimited pages for free
                        </span>
                    </div>
                </div>

                <div className="automation-snapshot-surface">
                    <div className="automation-snapshot-grid-layer" aria-hidden />
                    <span className="landing-hero-panel-edge-shimmer" aria-hidden />
                    <div className="relative z-10 space-y-5">
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-medium uppercase tracking-[0.12em] text-primary">
                                Automation snapshot
                            </p>
                            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/90 px-2.5 py-1 text-xs text-muted-foreground">
                                <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/35 opacity-75" />
                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                                </span>
                                <ServerCog className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                                Live
                            </span>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                            <div className="rounded-xl border border-border bg-muted/25 p-4 shadow-sm ring-0 ring-inset ring-transparent transition-shadow duration-200 ease-out hover:shadow-md hover:ring-1 hover:ring-primary/10 focus-within:shadow-md focus-within:ring-1 focus-within:ring-primary/15">
                                <p className="font-mono text-3xl font-bold tabular-nums tracking-tight text-foreground">
                                    {totalFollowersGained.toLocaleString()}
                                </p>
                                <p className="mt-1 text-sm leading-snug text-muted-foreground">
                                    Followers gained across automated pages
                                </p>
                            </div>
                            <div className="rounded-xl border border-border bg-muted/25 p-4 shadow-sm ring-0 ring-inset ring-transparent transition-shadow duration-200 ease-out hover:shadow-md hover:ring-1 hover:ring-primary/10 focus-within:shadow-md focus-within:ring-1 focus-within:ring-primary/15">
                                <p className="font-mono text-3xl font-bold tabular-nums tracking-tight text-foreground">
                                    {totalUsers.toLocaleString()}
                                </p>
                                <p className="mt-1 text-sm leading-snug text-muted-foreground">
                                    Users using fbuploadpro
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
