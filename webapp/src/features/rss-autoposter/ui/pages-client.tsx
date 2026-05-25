'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Search, Rss, ChevronRight, PauseCircle, PlayCircle, Layers } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AgencyEmptyState, AgencyInlineStatus } from '@/components/dashboard/agency'
import { HubLinkPendingOverlay } from '@/components/dashboard/hub-link-pending-overlay'
import { AddRssPageDialog } from './add-rss-page-dialog'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { rssPageStatusLabel } from '@/lib/rss-status-labels'

export type RssAutoposterPage = {
  id: string
  fb_page_id: string
  fb_page_name: string | null
  fb_page_image: string | null
  rss_feed_url: string
  status: string
  posts_per_day: number
  last_fetch_error: string | null
  template_preset_key: string | null
  created_at: string
  facebook_accounts?: {
    fb_user_name: string | null
    fb_user_image: string | null
    status: string | null
  } | null
}

const PAGE_SIZE = 9

export function RssPagesClient({
  initialPages,
  agencyId,
}: {
  initialPages: RssAutoposterPage[]
  agencyId: string
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return initialPages.filter(
      (p) =>
        (p.fb_page_name || '').toLowerCase().includes(q) ||
        p.rss_feed_url.toLowerCase().includes(q),
    )
  }, [initialPages, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, totalPages)
  const slice = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)

  async function toggleStatus(p: RssAutoposterPage) {
    if (togglingId) return
    const next = p.status === 'active' ? 'paused' : 'active'
    setTogglingId(p.id)
    try {
      const res = await fetch(`/api/v1/agency/facebook/rss-autoposter/pages/${p.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Update failed')
      }
      toast.success(next === 'active' ? 'Automation resumed' : 'Automation paused')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update')
    } finally {
      setTogglingId(null)
    }
  }

  if (initialPages.length === 0) {
    return (
      <div className="space-y-6">
        <AgencyEmptyState
          icon={<Rss className="h-6 w-6" />}
          title="No RSS pages connected"
          description="Connect a Facebook Page with an RSS feed and custom template to start auto-posting."
        />
        <div className="flex justify-center">
          <AddRssPageDialog agencyId={agencyId} />
        </div>
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="relative group">
        <div
          className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 to-blue-500/20 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100"
          aria-hidden
        />
        <div className="relative rounded-2xl border border-border/50 bg-card/40 p-5 shadow-2xl backdrop-blur-xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Layers className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-lg font-semibold">RSS Pages</h2>
                <p className="text-sm text-muted-foreground">
                  {filtered.length} {filtered.length === 1 ? 'page' : 'pages'} connected
                </p>
              </div>
            </div>
          </div>
          <div className="relative mb-4">
            <Search className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="h-12 rounded-xl border-border/50 bg-background/50 pl-11"
              placeholder="Search page or feed URL…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-3xl border border-dashed bg-muted/10 py-12 text-center">
              <p className="text-muted-foreground">No pages match your search.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 rounded-full"
                onClick={() => {
                  setSearch('')
                  setPage(1)
                }}
              >
                Clear search
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {slice.map((p, index) => {
                  const accountInvalid = p.facebook_accounts?.status === 'invalid_token'
                  const statusMeta = rssPageStatusLabel(
                    accountInvalid ? 'invalid_token' : p.status,
                  )
                  const isToggling = togglingId === p.id

                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.04 }}
                      className="group relative"
                    >
                      <div
                        className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 to-blue-500/20 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100"
                        aria-hidden
                      />
                      <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/50 bg-card/40 shadow-2xl backdrop-blur-xl transition-all hover:border-primary/30">
                        <Link
                          href={`/agency/facebook/rss-autoposter/${p.id}`}
                          className="absolute inset-0 z-[1] rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                          aria-label={`Manage ${p.fb_page_name || 'RSS page'}`}
                        >
                          <HubLinkPendingOverlay />
                        </Link>
                        <div
                          className={cn(
                            'pointer-events-none absolute top-0 left-0 z-[2] h-full w-1 transition-colors',
                            p.status === 'active' && !accountInvalid
                              ? 'bg-primary'
                              : 'bg-muted-foreground/20',
                          )}
                        />

                        <div className="pointer-events-none relative z-[2] flex flex-1 flex-col p-5 pl-6">
                          <div className="mb-3 flex items-start gap-3">
                            {p.fb_page_image ? (
                              <Image
                                src={p.fb_page_image}
                                alt=""
                                width={48}
                                height={48}
                                className="rounded-lg shadow-sm ring-2 ring-transparent transition-all group-hover:ring-primary/20"
                                unoptimized
                              />
                            ) : (
                              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted ring-2 ring-transparent transition-all group-hover:ring-primary/20">
                                <Rss className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-lg font-semibold group-hover:text-primary">
                                {p.fb_page_name || p.fb_page_id}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">{p.rss_feed_url}</p>
                            </div>
                            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                          </div>

                          <div className="mb-3 flex flex-wrap gap-2">
                            <AgencyInlineStatus
                              label={accountInvalid ? 'Invalid token' : statusMeta.label}
                              tone={accountInvalid ? 'destructive' : statusMeta.tone}
                              className="text-[11px]"
                            />
                            <Badge variant="outline">{p.posts_per_day}/day</Badge>
                            {p.template_preset_key ? (
                              <Badge variant="outline">{p.template_preset_key}</Badge>
                            ) : null}
                          </div>

                          {accountInvalid || p.last_fetch_error ? (
                            <p className="mb-3 text-xs text-destructive line-clamp-2">
                              {accountInvalid ? 'Reconnect Facebook account' : p.last_fetch_error}
                            </p>
                          ) : null}

                          <div className="pointer-events-auto relative z-[3] mt-auto flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="flex-1 rounded-xl"
                              asChild
                            >
                              <Link href={`/agency/facebook/rss-autoposter/${p.id}`}>Manage</Link>
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="rounded-xl"
                              disabled={isToggling || accountInvalid}
                              loading={isToggling}
                              onClick={() => toggleStatus(p)}
                              aria-label={p.status === 'active' ? 'Pause' : 'Resume'}
                            >
                              {p.status === 'active' ? (
                                <PauseCircle className="h-4 w-4" />
                              ) : (
                                <PlayCircle className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>

              {filtered.length > PAGE_SIZE && (
                <div className="mt-6 flex items-center justify-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={current === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {current} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={current >= totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  )
}
