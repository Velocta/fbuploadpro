'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Link2, Sparkles, Calendar, ExternalLink, Trash2 } from 'lucide-react'

const features = [
  {
    title: "Connect Unlimited Accounts & Pages",
    description: "Add as many Facebook profiles and business pages as your agency manages. No extra charges, no caps, and no monthly base subscription fees.",
    isFree: true,
    icon: Link2,
  },
  {
    title: "In-App Queue Scheduler",
    description: "Bulk upload your text, images, reels, or videos. Set your custom posting schedule, and the system publishes them directly. Avoid the reach penalties of traditional schedulers.",
    isFree: true,
    icon: Calendar,
  },
  {
    title: "Direct Facebook Scheduling",
    description: "For agencies who prefer native flows. Automatically schedule your posts directly on Facebook's native systems from our visual dashboard.",
    isFree: true,
    icon: ExternalLink,
  },
  {
    title: "Bulk Delete Posts",
    description: "Wipe or clean up page history instantly. Filter and bulk delete old posts or reels with one click to keep your pages fresh and compliant.",
    isFree: true,
    icon: Trash2,
  },
  {
    title: "Auto Download & Upload (ADU)",
    description: "Our core automated growth engine. Provide any creator's username (Instagram, TikTok, YouTube, or Facebook) and we automatically scrape captions, download the video, and publish it.",
    isFree: false,
    icon: Sparkles,
  },
]

export function FeaturesSection() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-24">
      <div className="mx-auto mb-14 max-w-3xl text-center">
        <Badge
          variant="outline"
          className="mb-4 px-4 py-1 text-xs font-semibold uppercase tracking-[0.12em] border-primary/20 bg-primary/5 text-primary"
        >
          All-in-One Capabilities
        </Badge>
        <h2 className="font-display text-display-md sm:text-display-lg mb-5 text-balance font-bold tracking-tight text-foreground">
          Built for modern agencies
        </h2>
        <p className="text-body-lg text-muted-foreground leading-relaxed">
          Everything you need to run high-volume pages. Core features are completely free—only pay for automated scraping when you use it.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
        {features.map((feat, index) => {
          const Icon = feat.icon
          return (
            <div key={index} className="relative overflow-hidden rounded-xl">
              <span className="marketing-card-conic-glow motion-reduce:animate-none" aria-hidden />
              <Card className="relative z-10 m-px overflow-hidden rounded-[calc(0.75rem-1px)] border border-border bg-card shadow-none transition-[box-shadow,border-color] duration-200 ease-out hover:border-primary/20 hover:shadow-md h-full flex flex-col justify-between">
                <CardContent className="p-6 sm:p-8 space-y-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/60 text-primary">
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      {feat.isFree ? (
                        <Badge variant="outline" className="border-emerald-500/25 bg-emerald-500/5 text-emerald-600 text-xs font-semibold px-2.5 py-0.5">
                          100% Free
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-primary/25 bg-primary/5 text-primary text-xs font-semibold px-2.5 py-0.5">
                          1 Token / Post
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-display text-xl font-semibold tracking-tight text-foreground leading-snug">
                      {feat.title}
                    </h3>
                  </div>

                  <p className="text-base text-muted-foreground leading-relaxed mt-3">
                    {feat.description}
                  </p>
                </CardContent>
              </Card>
            </div>
          )
        })}
      </div>
    </div>
  )
}
