'use client'

import { XCircle, CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const myths = [
  {
    myth: "I need to set up complex proxies or VPNs to keep my page location in the US or UK.",
    reality: "We handle this completely. All page actions are automatically routed through premium, private residential proxies matching your page's target location (like USA, New York). You don't need to purchase or configure anything.",
  },
  {
    myth: "I have to share my Facebook login passwords or session cookies to link accounts.",
    reality: "We connect securely using official Facebook Graph API permissions. You authenticate directly through Facebook. We never ask for, need, or store your passwords or cookies.",
  },
  {
    myth: "I have to keep my PC switched on for the downloading and scheduling to happen.",
    reality: "Everything runs 24/7 in the cloud. Video downloading, caption scraping, and publishing happen entirely on our high-speed servers. You can turn off your computer and close the tab.",
  },
  {
    myth: "This is just a command-line script or bot that might get my page flagged.",
    reality: "This is a fully hosted web application. Manage everything from a visual dashboard, organize posts in a visual queue, and let our system handle posting intervals safely.",
  },
]

export function MythbustersSection() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-24">
      <div className="mx-auto mb-14 max-w-3xl text-center">
        <Badge
          variant="outline"
          className="mb-4 px-4 py-1 text-xs font-semibold uppercase tracking-[0.12em] border-primary/20 bg-primary/5 text-primary"
        >
          Common Concerns
        </Badge>
        <h2 className="font-display text-display-md sm:text-display-lg mb-5 text-balance font-bold tracking-tight text-foreground">
          Objections & Reality
        </h2>
        <p className="text-body-lg text-muted-foreground leading-relaxed">
          There are many misconceptions about how API automation works. Let&apos;s set the record straight.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:gap-8">
        {myths.map((item, index) => (
          <div key={index} className="relative overflow-hidden rounded-xl">
            <span className="marketing-card-conic-glow motion-reduce:animate-none" aria-hidden />
            <Card className="relative z-10 m-px overflow-hidden rounded-[calc(0.75rem-1px)] border border-border bg-card shadow-none transition-[box-shadow,border-color] duration-200 ease-out hover:border-primary/20 hover:shadow-md">
              <CardContent className="p-6 sm:p-8 space-y-6">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <XCircle className="mt-1 h-5 w-5 shrink-0 text-destructive" />
                    <h3 className="font-display text-lg font-semibold text-muted-foreground leading-snug">
                      {item.myth}
                    </h3>
                  </div>
                </div>

                <div className="pt-4 border-t border-border/60">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-primary" />
                    <p className="text-base text-foreground leading-relaxed">
                      <span className="font-semibold text-primary block mb-1">Reality:</span>
                      {item.reality}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  )
}
