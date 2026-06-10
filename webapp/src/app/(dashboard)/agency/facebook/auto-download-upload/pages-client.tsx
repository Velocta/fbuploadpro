'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  Facebook,
  Instagram,
  Youtube,
  ChevronRight,
  Music,
  Users,
  Layers,
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { DeletePageDialog } from './delete-page-dialog'
import { PageWithReels } from '@/types/app.types'
import { cn } from '@/lib/utils'
import { formatPageAddedDate, formatPageAge } from '@/lib/page-age'
import { pageStatusLabel, syncStatusLabel } from '@/lib/adu-status-labels'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AgencyEmptyState, AgencyInlineStatus } from '@/components/dashboard/agency'
import { AduPageLinkPendingOverlay } from './adu-page-link-pending'

const PAGES_PAGE_SIZE = 9

export function PagesClient({ initialPages }: { initialPages: PageWithReels[] }) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)

  const filteredPages = useMemo(() => {
    const searchLower = search.toLowerCase()
    return initialPages.filter((p) => {
      const matchesSearch =
        (p.page_name || '').toLowerCase().includes(searchLower) ||
        (p.fb_page_id || '').toLowerCase().includes(searchLower) ||
        (p.source_username || '').toLowerCase().includes(searchLower)
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [initialPages, search, statusFilter])

  const sortedPages = useMemo(() => {
    return [...filteredPages].sort((a, b) => {
      switch (sortBy) {
        case 'followers_desc':
          return (b.followers_gained || 0) - (a.followers_gained || 0)
        case 'followers_asc':
          return (a.followers_gained || 0) - (b.followers_gained || 0)
        default:
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      }
    })
  }, [filteredPages, sortBy])

  const totalPages = Math.max(1, Math.ceil(sortedPages.length / PAGES_PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginatedPages = sortedPages.slice(
    (currentPage - 1) * PAGES_PAGE_SIZE,
    currentPage * PAGES_PAGE_SIZE,
  )

  const resetPage = () => setPage(1)

  if (initialPages.length === 0) {
    return (
      <AgencyEmptyState
        icon={<Facebook className="h-6 w-6" />}
        title="No pages found"
        description="Connect a Facebook account and add your first page to start automation."
      />
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <div className="relative group">
        <div
          className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 to-blue-500/20 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100"
          aria-hidden
        />
        <div className="relative rounded-2xl border border-border/50 bg-card/40 p-5 shadow-2xl backdrop-blur-xl">
          <div className="mb-4 flex items-center gap-3">
            <Layers className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Automation Pages</h2>
              <p className="text-sm text-muted-foreground">
                {sortedPages.length} {sortedPages.length === 1 ? 'page' : 'pages'}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search pages or sources..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  resetPage()
                }}
                className="h-12 rounded-xl border-border/50 bg-background/50 pl-11"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v)
                resetPage()
              }}
            >
              <SelectTrigger className="h-12 w-full rounded-xl border-border/50 bg-background/50 lg:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="fb_verification_required">Verification Req.</SelectItem>
                <SelectItem value="fb_rate_limited">Rate Limited</SelectItem>
                <SelectItem value="page_not_accessible">Page Not Accessible</SelectItem>
                <SelectItem value="invalid_token">Invalid Token</SelectItem>
                <SelectItem value="invalid_username">Invalid Username</SelectItem>
                <SelectItem value="creator_suspended">Creator Suspended</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={sortBy}
              onValueChange={(v) => {
                setSortBy(v)
                resetPage()
              }}
            >
              <SelectTrigger className="h-12 w-full rounded-xl border-border/50 bg-background/50 lg:w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="followers_desc">Most Followers</SelectItem>
                <SelectItem value="followers_asc">Least Followers</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {sortedPages.length === 0 ? (
        <div className="rounded-3xl border border-dashed bg-muted/10 py-20 text-center">
          <p className="text-muted-foreground">No pages match your search or filters.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 rounded-full"
            onClick={() => {
              setSearch('')
              setStatusFilter('all')
              resetPage()
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {paginatedPages.map((pageItem, index) => {
              const postedCount = pageItem.posted_reels_count || 0
              const pendingCount = pageItem.pending_reels_count || 0
              const failedCount = pageItem.failed_reels_count || 0
              const currentFollowers = pageItem.followers_gained || 0
              const startingFollowers = pageItem.followers_count || 0
              const followersDelta = currentFollowers - startingFollowers
              const addedDate = formatPageAddedDate(pageItem.created_at)
              const pageAge = formatPageAge(pageItem.created_at)
              const pageStatus = pageItem.status ?? 'inactive'
              const statusMeta = pageStatusLabel(pageStatus)
              const syncMeta = syncStatusLabel(pageItem.sync_status)
              const sourceIdentity =
                pageItem.source_platform === 'facebook'
                  ? pageItem.source_username
                  : `@${pageItem.source_username}`
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
                      href={`/agency/facebook/auto-download-upload/${pageItem.id}`}
                      className="absolute inset-0 z-[1] rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      aria-label={`Open ${pageItem.page_name || 'page'} details`}
                    >
                      <AduPageLinkPendingOverlay />
                    </Link>
                    <div
                      className={cn(
                        'pointer-events-none absolute top-0 left-0 z-[2] h-full w-1 transition-colors',
                        pageStatus === 'active' ? 'bg-primary' : 'bg-muted-foreground/20',
                      )}
                    />

                    <div className="pointer-events-none relative z-[2] flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2 p-5 pb-3 pl-6">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-3">
                          {pageItem.fb_page_image ? (
                            <Image
                              src={pageItem.fb_page_image}
                              alt={pageItem.page_name || 'Page'}
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
                              {pageItem.page_name}
                            </p>
                            <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                              {pageItem.fb_page_id}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <AgencyInlineStatus
                          label={statusMeta.label}
                          tone={statusMeta.tone}
                          className="text-[11px] capitalize"
                        />
                        <div className="pointer-events-auto relative z-[3]">
                          <DeletePageDialog pageId={pageItem.id} pageName={pageItem.page_name || 'Page'} />
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col px-5 pb-5 pl-6">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-border/50 bg-background/30 px-2 py-1.5">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Followers
                          </div>
                          <div className="flex items-center gap-1 text-sm font-bold text-primary">
                            <Users className="h-3.5 w-3.5" />
                            {currentFollowers.toLocaleString()}
                          </div>
                        </div>
                        <div className="rounded-lg border border-border/50 bg-background/30 px-2 py-1.5">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Gained
                          </div>
                          <div
                            className={cn(
                              'text-sm font-bold',
                              followersDelta >= 0 ? 'text-primary' : 'text-destructive',
                            )}
                          >
                            {followersDelta > 0 ? '+' : ''}
                            {followersDelta.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <p className="mt-2 text-xs text-muted-foreground">
                        Starting {startingFollowers.toLocaleString()} · Added {addedDate} · {pageAge}
                      </p>

                      {fbAccount?.fb_user_name ? (
                        <div className="mt-3 flex items-center gap-2 rounded-lg border border-border/50 bg-background/30 p-2 text-xs">
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
                            <span className="font-medium text-foreground">{fbAccount.fb_user_name}</span>
                          </span>
                        </div>
                      ) : null}

                      <div className="mt-3 flex items-center justify-between rounded-lg bg-muted/30 p-2 text-xs">
                        <div className="flex items-center text-muted-foreground">
                          {pageItem.source_platform === 'instagram' && (
                            <Instagram className="mr-1.5 h-3.5 w-3.5 text-primary/80" />
                          )}
                          {pageItem.source_platform === 'youtube' && (
                            <Youtube className="mr-1.5 h-3.5 w-3.5 text-primary/80" />
                          )}
                          {pageItem.source_platform === 'tiktok' && (
                            <Music className="mr-1.5 h-3.5 w-3.5 text-primary/80" />
                          )}
                          {pageItem.source_platform === 'facebook' && (
                            <Facebook className="mr-1.5 h-3.5 w-3.5 text-primary/80" />
                          )}
                          <span className="font-medium text-foreground">{sourceIdentity}</span>
                        </div>
                        <Badge
                          variant={syncMeta.variant}
                          title={syncMeta.tooltip}
                          className={cn(
                            'max-w-[120px] truncate bg-background text-[10px] font-normal capitalize',
                            syncMeta.variant === 'destructive' &&
                              'border-none bg-destructive text-destructive-foreground',
                          )}
                        >
                          {syncMeta.label}
                        </Badge>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {[
                          { label: 'Posted', value: postedCount, className: 'text-primary' },
                          { label: 'Pending', value: pendingCount, className: 'text-foreground' },
                          { label: 'Failed', value: failedCount, className: 'text-destructive' },
                        ].map((stat) => (
                          <div
                            key={stat.label}
                            className="flex flex-col items-center rounded-lg border border-border/50 bg-background/30 p-2"
                          >
                            <span className={cn('text-lg font-bold leading-none', stat.className)}>
                              {stat.value}
                            </span>
                            <span className="mt-1 text-[10px] font-semibold uppercase tracking-tight text-muted-foreground">
                              {stat.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {sortedPages.length > PAGES_PAGE_SIZE && (
            <div className="flex items-center justify-center gap-4 py-4">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </motion.div>
  )
}
