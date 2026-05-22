import type { Metadata } from 'next'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Facebook, Instagram, Sparkles, Youtube } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Migrating to v3 | FBupload Pro',
  description:
    'FBupload Pro is temporarily offline while we migrate to v3 with major new features for Facebook, YouTube, and Instagram.',
  robots: { index: false, follow: false },
}

const facebookFeatures = [
  'Text posting',
  'Image posting',
  'Stories posting',
  'Custom first comment',
  'Bulk page posts deletion',
  'Bulk group posts deletion',
  'Bulk Facebook account posts deletion',
  'Facebook page analytics',
  'Facebook account analytics',
  'Reels auto download & posting — preview posts before they go live',
  'Videos auto posting',
  'Bulk scheduling on Meta directly (videos, reels, images; Google Drive attachments)',
  'Bulk scheduling on our platform with direct publishing (videos, reels, images; Google Drive)',
  'Same posting & scheduling for Facebook profiles and groups',
  'Tags and categories for pages, accounts, and groups',
  'And much more',
]

const youtubeFeatures = [
  'Post or schedule on YouTube or on our platform — in bulk',
  'Videos and YouTube Shorts supported',
]

const instagramFeatures = [
  'Post or schedule on Instagram or on our platform — in bulk',
  'Reels, images, stories, and carousel posts',
]

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export default function MaintenancePage() {
  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-background text-foreground">
      <div className="landing-page-mist pointer-events-none absolute inset-0" aria-hidden>
        <div className="landing-page-mist-blob-a motion-reduce:animate-none animate-pulse-slow" />
        <div className="landing-page-mist-blob-b motion-reduce:animate-none animate-mist-drift" />
        <div className="landing-page-mist-blob-c" />
      </div>

      <header className="relative z-10 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Image
            src="/logo.svg"
            alt="FBupload Pro"
            width={32}
            height={32}
            className="h-8 w-8"
            unoptimized
          />
          <span className="font-display text-lg font-semibold tracking-tight">FBupload Pro</span>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <section className="mx-auto max-w-3xl text-center">
          <Badge variant="secondary" className="mb-4 border-primary/20 bg-primary/10 text-primary">
            Update in progress
          </Badge>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            We&apos;re migrating to <span className="text-primary">v3</span>
          </h1>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            The site is temporarily unavailable for a few days while we upgrade the platform.
            Thank you for your patience — a much more powerful experience is on the way.
          </p>
        </section>

        <section className="mt-12">
          <div className="mb-8 text-center">
            <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">New features</h2>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Here&apos;s what&apos;s coming in FBupload Pro v3 across Facebook, YouTube, and Instagram.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="border-primary/15 bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Facebook className="h-5 w-5 text-[#1877F2]" aria-hidden />
                  Facebook
                </CardTitle>
                <CardDescription>Powerful publishing, cleanup, analytics, and scheduling</CardDescription>
              </CardHeader>
              <CardContent>
                <FeatureList items={facebookFeatures} />
              </CardContent>
            </Card>

            <Card className="border-primary/15 bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Youtube className="h-5 w-5 text-[#FF0000]" aria-hidden />
                  YouTube
                </CardTitle>
                <CardDescription>Bulk video and Shorts workflows</CardDescription>
              </CardHeader>
              <CardContent>
                <FeatureList items={youtubeFeatures} />
              </CardContent>
            </Card>

            <Card className="border-primary/15 bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Instagram className="h-5 w-5 text-[#E4405F]" aria-hidden />
                  Instagram
                </CardTitle>
                <CardDescription>Reels, stories, carousels, and more</CardDescription>
              </CardHeader>
              <CardContent>
                <FeatureList items={instagramFeatures} />
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        FBupload Pro · Migration to v3 · We&apos;ll be back soon
      </footer>
    </div>
  )
}
