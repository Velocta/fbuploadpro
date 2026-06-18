'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Rss, ArrowLeft, ChevronDown, History } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AgencyEmptyState, AgencyGlassPageHero } from '@/components/dashboard/agency'
import { TimezoneSelect } from '@/components/dashboard/timezone-select'
import { PostsPerDayPicker } from '@/components/dashboard/posts-per-day-picker'
import { TimeSlotInput } from '@/components/dashboard/time-slot-input'
import { generateBalancedPostTimes } from '@/lib/scheduling'
import type { CanvasAspectRatio, RssTemplateDefinition } from '@/contracts/rss-autoposter'
import { TemplateBuilder } from './template-builder'
import { RSS_TEMPLATE_PRESETS } from '@/lib/rss-autoposter/presets'
import { RssPageDetailAlerts } from './rss-page-detail-alerts'
import { rssItemStatusLabel } from '@/lib/rss-status-labels'
import { cn } from '@/lib/utils'

type PageRow = {
  id: string
  fb_page_name: string | null
  rss_feed_url: string
  status: string
  timezone: string
  posts_per_day: number
  schedule_type: string
  posting_times: string[]
  template_definition: RssTemplateDefinition
  template_preset_key: string | null
  canvas_aspect_ratio: CanvasAspectRatio
  first_comment: string | null
  brand_site_url: string | null
  last_fetch_error: string | null
  facebook_accounts: { status: string | null } | null
}

type ItemRow = {
  id: string
  title: string | null
  status: string
  published_at: string | null
  error_message: string | null
  graph_post_id: string | null
  created_at: string
}

export function RssPageDetailClient({
  page,
  initialItems,
}: {
  page: PageRow
  initialItems: ItemRow[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null)
  const [rssFeedUrl, setRssFeedUrl] = useState(page.rss_feed_url)
  const [timezone, setTimezone] = useState(page.timezone)
  const [postsPerDay, setPostsPerDay] = useState(String(page.posts_per_day))
  const [scheduleType, setScheduleType] = useState<'dailyrandom' | 'fixed' | 'randomfixed'>(
    (page.schedule_type as 'dailyrandom' | 'fixed' | 'randomfixed') || 'dailyrandom',
  )
  const [postingTimes, setPostingTimes] = useState<string[]>(
    Array.isArray(page.posting_times) ? page.posting_times : [],
  )
  const [templateDefinition, setTemplateDefinition] = useState<RssTemplateDefinition>(
    (page.template_definition as RssTemplateDefinition) ||
      RSS_TEMPLATE_PRESETS['breaking-banner']!.definition,
  )
  const [canvasAspectRatio, setCanvasAspectRatio] = useState<CanvasAspectRatio>(
    page.canvas_aspect_ratio || '4:5',
  )
  const [firstComment, setFirstComment] = useState(page.first_comment || '')
  const [brandSiteUrl, setBrandSiteUrl] = useState(page.brand_site_url || '')

  const accountInvalid = page.facebook_accounts?.status === 'invalid_token'

  useEffect(() => {
    const count = parseInt(postsPerDay, 10)
    const t = setTimeout(() => {
      if (scheduleType === 'fixed') {
        setPostingTimes((prev) => {
          const next = [...prev]
          while (next.length < count) next.push('')
          return next.slice(0, count)
        })
      } else if (scheduleType === 'dailyrandom' || scheduleType === 'randomfixed') {
        setPostingTimes(generateBalancedPostTimes(count))
      }
    }, 0)
    return () => clearTimeout(t)
  }, [postsPerDay, scheduleType])

  const fixedTimesIncomplete =
    scheduleType === 'fixed' && postingTimes.some((t) => !t)

  function saveSettings() {
    if (fixedTimesIncomplete) {
      toast.error('Select a time for each post slot')
      return
    }
    startTransition(async () => {
      try {
        const times =
          scheduleType === 'fixed'
            ? postingTimes
            : generateBalancedPostTimes(parseInt(postsPerDay, 10))
        const res = await fetch(`/api/v1/agency/facebook/rss-autoposter/pages/${page.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            rssFeedUrl,
            timezone,
            postsPerDay: parseInt(postsPerDay, 10),
            scheduleType,
            postingTimes: times,
            firstComment: firstComment || null,
            brandSiteUrl: brandSiteUrl.trim() || null,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Save failed')
        toast.success('Settings saved')
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Save failed')
      }
    })
  }

  function saveTemplate() {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/agency/facebook/rss-autoposter/pages/${page.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            templateDefinition,
            canvasAspectRatio,
            templatePresetKey: 'custom',
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Save failed')
        toast.success('Template saved')
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Save failed')
      }
    })
  }

  return (
    <div className="space-y-6 pb-8 agency-motion-standard">
      <AgencyGlassPageHero
        segments={[
          { label: 'Agency', href: '/agency' },
          { label: 'RSS Auto Poster', href: '/agency/facebook/rss-autoposter' },
          { label: page.fb_page_name || 'Page' },
        ]}
        icon={<Rss className="h-7 w-7 text-primary" />}
        title={page.fb_page_name || 'RSS Page'}
        description={page.rss_feed_url}
        actions={
          <Button variant="outline" className="rounded-xl" asChild>
            <Link href="/agency/facebook/rss-autoposter">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
        }
      />

      <RssPageDetailAlerts
        accountInvalid={accountInvalid}
        lastFetchError={page.last_fetch_error}
      />

      <Tabs defaultValue="settings" className="space-y-4">
        <div className="rounded-2xl border border-border/50 bg-card/40 p-2 shadow-2xl backdrop-blur-xl">
          <TabsList className="grid h-11 w-full grid-cols-3 rounded-xl bg-muted/50 p-1">
            <TabsTrigger value="settings" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Settings
            </TabsTrigger>
            <TabsTrigger value="template" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Template
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              History (7d)
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="settings" className="mt-0 space-y-4">
          <div className="rounded-2xl border border-border/50 bg-card/40 p-5 shadow-2xl backdrop-blur-xl">
            <p className="mb-4 text-sm font-semibold text-foreground">Feed & schedule</p>
            <div className="space-y-4">
              <div>
                <Label>RSS feed URL</Label>
                <Input
                  value={rssFeedUrl}
                  onChange={(e) => setRssFeedUrl(e.target.value)}
                  className="mt-1.5 rounded-xl"
                />
              </div>
              <TimezoneSelect value={timezone} onValueChange={setTimezone} />
              <PostsPerDayPicker
                value={parseInt(postsPerDay, 10) || 1}
                onValueChange={setPostsPerDay}
              />
              <div>
                <Label>Schedule type</Label>
                <Select
                  value={scheduleType}
                  onValueChange={(v) => setScheduleType(v as typeof scheduleType)}
                >
                  <SelectTrigger className="mt-1.5 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dailyrandom">Daily random</SelectItem>
                    <SelectItem value="fixed">Fixed times</SelectItem>
                    <SelectItem value="randomfixed">Random fixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {scheduleType === 'fixed' && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {postingTimes.map((time, index) => (
                    <TimeSlotInput
                      key={`edit-rss-time-${index}`}
                      idPrefix={`edit-rss-time-${index}`}
                      value={time || ''}
                      onChange={(value) => {
                        setPostingTimes((prev) => {
                          const next = [...prev]
                          next[index] = value
                          return next
                        })
                      }}
                    />
                  ))}
                </div>
              )}
              {fixedTimesIncomplete ? (
                <p className="text-sm text-destructive">Select a time for each post slot.</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-border/50 bg-card/40 p-5 shadow-2xl backdrop-blur-xl">
            <p className="mb-4 text-sm font-semibold text-foreground">Optional</p>
            <div className="space-y-4">
              <div>
                <Label>Brand site URL</Label>
                <Input
                  value={brandSiteUrl}
                  onChange={(e) => setBrandSiteUrl(e.target.value)}
                  placeholder="https://yoursite.com"
                  className="mt-1.5 rounded-xl"
                />
              </div>
              <div>
                <Label>First comment</Label>
                <Input
                  value={firstComment}
                  onChange={(e) => setFirstComment(e.target.value)}
                  placeholder="Posted via…"
                  className="mt-1.5 rounded-xl"
                />
              </div>
            </div>
          </div>

          <Button onClick={saveSettings} loading={isPending} className="rounded-xl">
            Save settings
          </Button>
        </TabsContent>

        <TabsContent value="template" className="mt-0 space-y-4">
          <div className="rounded-2xl border border-border/50 bg-card/40 p-5 shadow-2xl backdrop-blur-xl">
            <TemplateBuilder
              definition={templateDefinition}
              onChange={setTemplateDefinition}
              canvasAspectRatio={canvasAspectRatio}
              onAspectRatioChange={setCanvasAspectRatio}
              brandSiteUrl={brandSiteUrl}
            />
          </div>
          <Button onClick={saveTemplate} loading={isPending} className="rounded-xl">
            Save template
          </Button>
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          <div className="rounded-2xl border border-border/50 bg-card/40 p-5 shadow-2xl backdrop-blur-xl">
            {initialItems.length === 0 ? (
              <AgencyEmptyState
                icon={<History className="h-6 w-6" />}
                title="No posts in the last 7 days"
                description="Published, failed, and skipped items from the past week appear here."
              />
            ) : (
              <ul className="divide-y divide-border/50">
                {initialItems.map((item) => {
                  const statusMeta = rssItemStatusLabel(item.status)
                  const showError = item.status === 'failed' && item.error_message
                  const isExpanded = expandedErrorId === item.id

                  return (
                    <li key={item.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <span className="min-w-0 flex-1 font-medium">
                          {item.title || 'Untitled'}
                        </span>
                        <Badge variant={statusMeta.variant} className="shrink-0 capitalize">
                          {statusMeta.label}
                        </Badge>
                      </div>
                      {item.published_at ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(item.published_at).toLocaleString()}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(item.created_at).toLocaleString()}
                        </p>
                      )}
                      {showError ? (
                        <div className="mt-2">
                          <button
                            type="button"
                            className="flex items-center gap-1 text-xs font-medium text-destructive hover:underline"
                            onClick={() =>
                              setExpandedErrorId(isExpanded ? null : item.id)
                            }
                          >
                            <ChevronDown
                              className={cn(
                                'h-3.5 w-3.5 transition-transform',
                                isExpanded && 'rotate-180',
                              )}
                            />
                            {isExpanded ? 'Hide error' : 'Show error'}
                          </button>
                          {isExpanded ? (
                            <p className="mt-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                              {item.error_message}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
