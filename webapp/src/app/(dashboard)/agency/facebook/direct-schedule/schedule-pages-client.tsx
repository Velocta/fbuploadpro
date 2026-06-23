'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Search,
  Facebook,
  ChevronRight,
  Layers,
  TrendingUp,
  XCircle,
  Loader2,
  CalendarClock,
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { DeleteSchedulePageDialog } from './delete-schedule-page-dialog'
import { AddSchedulePageDialog } from './add-schedule-page-dialog'
import { AgencyEmptyState, AgencyGlassPageHero } from '@/components/dashboard/agency'
import { toast } from 'sonner'

type SchedulePage = {
  id: string
  fb_page_id: string
  fb_page_name: string | null
  fb_page_image: string | null
  created_at: string | null
  facebook_accounts: { fb_user_name: string | null; fb_user_image: string | null } | null
}

type Stats = {
  scheduled: number
  failed: number
}

const PAGES_PAGE_SIZE = 9

function DirectScheduleSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats Skeleton */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 rounded-2xl border border-border/50 bg-card/40 p-5 animate-pulse flex flex-col justify-between"
          >
            <div className="h-4 w-24 bg-muted/20 rounded" />
            <div className="h-6 w-16 bg-muted/20 rounded" />
          </div>
        ))}
      </div>

      {/* Search Bar Skeleton */}
      <div className="h-20 rounded-2xl border border-border/50 bg-card/40 p-5 animate-pulse" />

      {/* Pages Grid Skeleton */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[200px] rounded-2xl border border-border/50 bg-card/40 p-5 animate-pulse flex flex-col justify-between"
          >
            <div className="flex gap-3">
              <div className="h-12 w-12 bg-muted/20 rounded-lg" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-32 bg-muted/20 rounded" />
                <div className="h-3 w-20 bg-muted/20 rounded" />
              </div>
            </div>
            <div className="h-10 bg-muted/20 rounded-lg w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function SchedulePagesClient({ userId }: { userId: string }) {
  const [pages, setPages] = useState<SchedulePage[]>([])
  const [stats, setStats] = useState<Stats>({ scheduled: 0, failed: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [isPageChanging, setIsPageChanging] = useState(false)

  const loadData = async () => {
    try {
      const res = await fetch('/api/v1/agency/facebook/direct-schedule/pages')
      const result = await res.json()
      if (res.ok) {
        setPages(result.pages || [])
        setStats(result.stats || { scheduled: 0, failed: 0 })
      } else {
        toast.error('Failed to load scheduling pages', {
          description: result.error || 'Unknown error',
        })
      }
    } catch {
      toast.error('Failed to load scheduling pages')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData()
  }, [])

  const filteredPages = useMemo(() => {
    const searchLower = search.toLowerCase()
    return pages.filter((p) => {
      const matchesSearch =
        (p.fb_page_name || '').toLowerCase().includes(searchLower) ||
        (p.fb_page_id || '').toLowerCase().includes(searchLower)
      return matchesSearch
    })
  }, [pages, search])

  const totalPages = Math.max(1, Math.ceil(filteredPages.length / PAGES_PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginatedPages = filteredPages.slice(
    (currentPage - 1) * PAGES_PAGE_SIZE,
    currentPage * PAGES_PAGE_SIZE,
  )

  const handlePageChange = (newPage: number) => {
    setIsPageChanging(true)
    setTimeout(() => {
      setPage(newPage)
      setIsPageChanging(false)
    }, 150)
  }

  const uiStats = [
    {
      label: 'Total Pages',
      value: pages.length.toLocaleString(),
      icon: Layers,
    },
    {
      label: 'Scheduled Posts',
      value: stats.scheduled.toLocaleString(),
      icon: TrendingUp,
    },
    {
      label: 'Failed Posts',
      value: stats.failed.toLocaleString(),
      icon: XCircle,
    },
  ]

  return (
    <div className="space-y-6">
      <AgencyGlassPageHero
        segments={[
          { label: 'Agency', href: '/agency' },
          { label: 'Direct Schedule' },
        ]}
        icon={<CalendarClock className="h-7 w-7 text-primary" />}
        title="Direct Schedule"
        description="Schedule posts natively on Facebook."
        actions={<AddSchedulePageDialog agencyId={userId} onSuccess={loadData} />}
        tutorialHref="https://youtube.com/watch?v=placeholder"
      />

      {loading ? (
        <DirectScheduleSkeleton />
      ) : pages.length === 0 ? (
        <AgencyEmptyState
          icon={<Facebook className="h-6 w-6" />}
          title="No pages found"
          description="Connect a Facebook account and add your first page to start scheduling."
        />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          {/* Stats Cards */}
          <div className="relative group">
            <div
              className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 to-blue-500/20 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100"
              aria-hidden
            />
            <div className="relative grid gap-4 rounded-2xl border border-border/50 bg-card/40 p-5 shadow-2xl backdrop-blur-xl sm:grid-cols-3">
              {uiStats.map((stat) => {
                const Icon = stat.icon
                return (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-border/50 bg-background/30 p-4"
                  >
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Icon className="h-4 w-4 text-primary" />
                      {stat.label}
                    </div>
                    <p className="font-display text-2xl font-bold tracking-tight">
                      {stat.value}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Search Card */}
          <div className="relative group">
            <div
              className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 to-blue-500/20 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100"
              aria-hidden
            />
            <div className="relative rounded-2xl border border-border/50 bg-card/40 p-5 shadow-2xl backdrop-blur-xl">
              <div className="mb-4 flex items-center gap-3">
                <Layers className="h-5 w-5 text-primary" />
                <div>
                  <h2 className="text-lg font-semibold">Scheduling Pages</h2>
                  <p className="text-sm text-muted-foreground">
                    {filteredPages.length} {filteredPages.length === 1 ? 'page' : 'pages'}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search pages by name or ID..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      setPage(1)
                    }}
                    className="h-12 rounded-xl border-border/50 bg-background/50 pl-11"
                  />
                </div>
              </div>
            </div>
          </div>

          {filteredPages.length === 0 ? (
            <div className="rounded-3xl border border-dashed bg-muted/10 py-20 text-center">
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
                Clear filters
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {paginatedPages.map((pageItem, index) => {
                  const fbAccount = Array.isArray(pageItem.facebook_accounts)
                    ? pageItem.facebook_accounts[0]
                    : pageItem.facebook_accounts

                  return (
                    <motion.div
                      key={pageItem.id}
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
                          href={`/agency/facebook/direct-schedule/${pageItem.id}`}
                          className="absolute inset-0 z-[1] rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                          aria-label={`Open ${pageItem.fb_page_name || 'page'} details`}
                        />

                        <div className="pointer-events-none absolute top-0 left-0 z-[2] h-full w-1 bg-primary transition-colors" />

                        <div className="pointer-events-none relative z-[2] flex flex-1 flex-col">
                          <div className="flex items-start justify-between gap-2 p-5 pb-3 pl-6">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start gap-3">
                                {pageItem.fb_page_image ? (
                                  <Image
                                    src={pageItem.fb_page_image}
                                    alt={pageItem.fb_page_name || 'Page'}
                                    width={48}
                                    height={48}
                                    className="rounded-lg shadow-sm ring-2 ring-transparent transition-all group-hover:ring-primary/20"
                                    unoptimized
                                  />
                                ) : (
                                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted ring-2 ring-transparent transition-all group-hover:ring-primary/20">
                                    <Facebook className="h-5 w-5 text-muted-foreground" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="truncate text-lg font-semibold group-hover:text-primary">
                                    {pageItem.fb_page_name}
                                  </p>
                                  <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                                    {pageItem.fb_page_id}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-2">
                              <div className="pointer-events-auto relative z-[3]">
                                <DeleteSchedulePageDialog
                                  pageId={pageItem.id}
                                  pageName={pageItem.fb_page_name || 'Page'}
                                  onSuccess={loadData}
                                />
                              </div>
                              <ChevronRight className="h-5 w-5 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                            </div>
                          </div>

                          <div className="flex flex-1 flex-col px-5 pb-5 pl-6">
                            {fbAccount?.fb_user_name ? (
                              <div className="mt-auto pt-4 flex items-center gap-2 rounded-lg border border-border/50 bg-background/30 p-2 text-xs">
                                {fbAccount.fb_user_image ? (
                                  <Image
                                    src={fbAccount.fb_user_image}
                                    alt={fbAccount.fb_user_name}
                                    width={24}
                                    height={24}
                                    className="rounded-full border border-border"
                                    unoptimized
                                  />
                                ) : (
                                  <Facebook className="h-4 w-4 shrink-0 text-muted-foreground" />
                                )}
                                <span className="truncate text-muted-foreground">
                                  via{' '}
                                  <span className="font-medium text-foreground">
                                    {fbAccount.fb_user_name}
                                  </span>
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>

              {filteredPages.length > PAGES_PAGE_SIZE && (
                <div className="flex items-center justify-center gap-4 py-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => {
                      const newPage = Math.max(1, currentPage - 1)
                      handlePageChange(newPage)
                    }}
                    disabled={currentPage === 1 || isPageChanging}
                  >
                    {isPageChanging && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => {
                      const newPage = Math.min(totalPages, currentPage + 1)
                      handlePageChange(newPage)
                    }}
                    disabled={currentPage >= totalPages || isPageChanging}
                  >
                    {isPageChanging && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </motion.div>
      )}
    </div>
  )
}
