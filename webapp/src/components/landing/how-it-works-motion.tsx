'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { AtSign, CalendarClock, Link2 } from 'lucide-react'

const easeStandard = [0.2, 0, 0, 1] as const

const viewport = { once: true, margin: '-64px 0px' } as const

export type HowItWorksStep = {
    number: string
    title: string
    description: string
}

const stepIcons = [Link2, AtSign, CalendarClock] as const

type Props = {
    steps: HowItWorksStep[]
}

export function HowItWorksSectionMotion({ steps }: Props) {
    const reduce = useReducedMotion()

    const headerBlock = {
        hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 14 },
        visible: {
            opacity: 1,
            ...(reduce ? {} : { y: 0 }),
            transition: reduce
                ? { duration: 0.2, ease: easeStandard }
                : { duration: 0.4, ease: easeStandard },
        },
    }

    const listContainer = {
        hidden: {},
        visible: {
            transition: reduce
                ? { duration: 0.2, ease: easeStandard }
                : {
                      staggerChildren: 0.07,
                      delayChildren: 0.04,
                  },
        },
    }

    const row = {
        hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 18 },
        visible: {
            opacity: 1,
            ...(reduce ? {} : { y: 0 }),
            transition: reduce
                ? { duration: 0.2, ease: easeStandard }
                : { duration: 0.42, ease: easeStandard },
        },
    }

    return (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <motion.div
                className="mx-auto mb-14 max-w-3xl text-center"
                variants={headerBlock}
                initial="hidden"
                whileInView="visible"
                viewport={viewport}
            >
                <p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                    How It Works
                </p>
                <h2
                    id="how-it-works-heading"
                    className="font-display text-display-md sm:text-display-lg mb-5 text-balance font-bold tracking-tight text-foreground"
                >
                    Launch automation with a simple 3-step flow
                </h2>
                <p className="text-body-lg text-muted-foreground leading-relaxed">
                    Setup takes minutes. After that, your publishing runs automatically on schedule.
                </p>
            </motion.div>

            <motion.ol className="mx-auto max-w-3xl list-none space-y-0 p-0 lg:max-w-5xl" variants={listContainer} initial="hidden" whileInView="visible" viewport={viewport}>
                {steps.map((step, index) => {
                    const Icon = stepIcons[index] ?? Link2
                    const isLast = index === steps.length - 1
                    return (
                        <motion.li key={step.number} variants={row} className="flex gap-5 pb-12 last:pb-0 sm:gap-8">
                            <div className="flex shrink-0 flex-col items-center pt-1">
                                <span className="font-display relative z-[1] flex h-12 w-12 items-center justify-center rounded-full border border-primary/25 bg-secondary text-sm font-bold text-primary shadow-sm ring-4 ring-card">
                                    {step.number}
                                </span>
                                {!isLast && (
                                    <div
                                        className="mt-2 min-h-10 w-px flex-1 bg-gradient-to-b from-primary/35 via-primary/15 to-border"
                                        aria-hidden
                                    />
                                )}
                            </div>
                            <div className="group/card relative min-w-0 flex-1 overflow-hidden rounded-xl">
                                <span
                                    className="marketing-card-conic-glow motion-reduce:animate-none"
                                    aria-hidden
                                />
                                <article className="relative z-10 m-px rounded-[calc(0.75rem-1px)] border border-border bg-card p-6 shadow-sm transition-[box-shadow,transform,border-color] duration-200 ease-out hover:border-primary/20 hover:shadow-md motion-reduce:transform-none motion-reduce:hover:translate-y-0 sm:p-7 hover:-translate-y-1">
                                <div className="relative z-10 mb-4 flex items-start gap-3">
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/60 text-primary transition-transform duration-200 ease-out group-hover/card:scale-[1.02] group-focus-within/card:scale-[1.02] motion-reduce:group-hover/card:scale-100 motion-reduce:group-focus-within/card:scale-100">
                                        <Icon className="h-5 w-5" aria-hidden />
                                    </span>
                                    <h3 className="font-display pt-1.5 text-xl font-semibold tracking-tight text-foreground sm:text-2xl sm:leading-snug">
                                        {step.title}
                                    </h3>
                                </div>
                                <p className="relative z-10 text-base leading-relaxed text-muted-foreground">
                                    {step.description}
                                </p>
                                </article>
                            </div>
                        </motion.li>
                    )
                })}
            </motion.ol>
        </div>
    )
}
