'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Search,
  Facebook,
  ChevronRight,
  Layers,
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { DeleteInappPageDialog } from './delete-inapp-page-dialog'
import { AgencyEmptyState, AgencyInlineStatus } from '@/components/dashboard/agency'
import { AddInappPageDialog } from './add-inapp-page-dialog'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { pageStatusLabel } from '@/lib/adu-status-labels'

export type InappPage = {
  id: string
  fb_page_id: string
  fb_page_name: string | null
  fb_page_image: string | null
  created_at: string | null
  status: string | null
  followers_count: number | null
  followers_gained: number | null
  changed_followers: number | null
  is_followers_updated: boolean
  facebook_accounts: { fb_user_name: string | null; fb_user_image: string | null } | null
  pending_posts_count: number | null
  posted_posts_count: number | null
  failed_posts_count: number | null
}

const PAGES_PAGE_SIZE = 9

export function InappPagesClient({ initialPages, agencyId }: { initialPages: InappPage[], agencyId: string }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const initialSearch = searchParams.get('q') || ''
  const initialSortBy = searchParams.get('sort') || 'newest'
  const initialStatusFilter = searchParams.get('status') || 'all'
  const pageParam = searchParams.get('page')
  const initialPage = pageParam ? parseInt(pageParam, 10) || 1 : 1

  // Local React states for instantaneous responsiveness
  const [search, setSearch] = useState(initialSearch)
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter)
  const [sortBy, setSortBy] = useState(initialSortBy)
  const [page, setPage] = useState(initialPage)

  const [searchInput, setSearchInput] = useState(initialSearch)

  // Sync state if URL changes externally
  useEffect(() => {
    setSearch(initialSearch)
    setSearchInput(initialSearch)
  }, [initialSearch])

  useEffect(() => {
    setStatusFilter(initialStatusFilter)
  }, [initialStatusFilter])

  useEffect(() => {
    setSortBy(initialSortBy)
  }, [initialSortBy])

  useEffect(() => {
    setPage(initialPage)
  }, [initialPage])

  const updateFiltersUrl = useCallback((updates: { q?: string | null; sort?: string | null; status?: string | null; page?: number | null }) => {
    const params = new URLSearchParams(window.location.search)
    if ('q' in updates) {
      const qVal = updates.q?.trim()
      if (qVal) params.set('q', qVal)
      else params.delete('q')
      params.delete('page')
    }
    if ('sort' in updates) {
      if (updates.sort && updates.sort !== 'newest') params.set('sort', updates.sort)
      else params.delete('sort')
      params.delete('page')
    }
    if ('status' in updates) {
      if (updates.status && updates.status !== 'all') params.set('status', updates.status)
      else params.delete('status')
      params.delete('page')
    }
    if ('page' in updates) {
      if (updates.page && updates.page > 1) params.set('page', String(updates.page))
      else params.delete('page')
    }
    const newUrl = `${pathname}?${params.toString()}`
    window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, '', newUrl)
  }, [pathname])

  // Debounce URL updates for search queries to keep typing fluid
  useEffect(() => {
    const t = setTimeout(() => {
      const currentUrlQuery = new URLSearchParams(window.location.search).get('q') || ''
      if (search !== currentUrlQuery) {
        updateFiltersUrl({ q: search, page: 1 })
      }
    }, 400)
    return () => clearTimeout(t)
  }, [search, updateFiltersUrl])

  const filteredPages = useMemo(() => {
    const searchLower = search.toLowerCase().trim()
    return initialPages.filter((p) => {
      const matchesSearch =
        !searchLower ||
        (p.fb_page_name || '').toLowerCase().includes(searchLower) ||
        (p.fb_page_id || '').toLowerCase().includes(searchLower)
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [initialPages, search, statusFilter])

  const sortedPages = useMemo(() => {
    return [...filteredPages].sort((a, b) => {
      switch (sortBy) {
        case 'followers_desc':
          return (b.followers_count || 0) - (a.followers_count || 0)
        case 'followers_asc':
          return (a.followers_count || 0) - (b.followers_count || 0)
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
        description="Connect a Facebook account and add your first page to start scheduling."
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
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Layers className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-lg font-semibold">Scheduling Pages</h2>
                <p className="text-sm text-muted-foreground">
                  {sortedPages.length} {sortedPages.length === 1 ? 'page' : 'pages'}
                </p>
              </div>
            </div>
            <AddInappPageDialog agencyId={agencyId} />
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search pages by name or ID..."
                value={searchInput}
                onChange={(e) => {
                  const val = e.target.value
                  setSearchInput(val)
                  setSearch(val)
                  setPage(1)
                }}
                className="h-12 rounded-xl border-border/50 bg-background/50 pl-11"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v)
                setPage(1)
                updateFiltersUrl({ status: v, page: 1 })
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
                <SelectItem value="2fa_required_on_BM">2FA Req. on BM</SelectItem>
                <SelectItem value="check_developer_app">Check Dev App</SelectItem>
                <SelectItem value="account_suspended">Account Suspended</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={sortBy}
              onValueChange={(v) => {
                setSortBy(v)
                setPage(1)
                updateFiltersUrl({ sort: v, page: 1 })
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
              setSearchInput('')
              setSearch('')
              setStatusFilter('all')
              setSortBy('newest')
              setPage(1)
              updateFiltersUrl({ q: null, status: null, sort: null, page: null })
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
                      href={`/agency/facebook/inapp-schedule/${pageItem.id}`}
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
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-lg font-semibold group-hover:text-primary">
                                  {pageItem.fb_page_name}
                                </p>
                                {pageItem.status && (
                                  <AgencyInlineStatus
                                    label={pageStatusLabel(pageItem.status).label}
                                    tone={pageStatusLabel(pageItem.status).tone}
                                    className="text-[10px] capitalize shrink-0 font-bold border uppercase tracking-wider"
                                  />
                                )}
                              </div>
                              <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                                {pageItem.fb_page_id}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <div className="pointer-events-auto relative z-[3]">
                            <DeleteInappPageDialog pageId={pageItem.id} pageName={pageItem.fb_page_name || 'Page'} />
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                        </div>
                      </div>

                      <div className="flex flex-1 flex-col px-5 pb-5 pl-6">
                        {/* Followers metrics */}
                        <div className="grid grid-cols-2 gap-4 rounded-xl border border-border/50 bg-background/20 p-3 text-xs">
                          <div>
                            <span className="block text-muted-foreground text-[10px] uppercase font-medium">Followers</span>
                            <span className="font-semibold text-foreground">
                              {pageItem.followers_count !== null ? pageItem.followers_count.toLocaleString() : '—'}
                            </span>
                          </div>
                          <div>
                            <span className="block text-muted-foreground text-[10px] uppercase font-medium">Net Growth</span>
                            <span className={cn(
                              "font-semibold",
                              (pageItem.changed_followers || 0) > 0 
                                ? "text-emerald-500" 
                                : (pageItem.changed_followers || 0) < 0 
                                  ? "text-red-500" 
                                  : "text-muted-foreground"
                            )}>
                              {(pageItem.changed_followers || 0) > 0 ? '+' : ''}
                              {pageItem.changed_followers !== null ? pageItem.changed_followers.toLocaleString() : '0'}
                            </span>
                          </div>
                        </div>

                        {/* Post statistics counters */}
                        <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-border/50 bg-background/10 p-2 text-center text-xs">
                          <div>
                            <span className="block text-muted-foreground text-[9px] uppercase font-medium">Pending</span>
                            <span className="font-semibold text-blue-400">
                              {pageItem.pending_posts_count ?? 0}
                            </span>
                          </div>
                          <div>
                            <span className="block text-muted-foreground text-[9px] uppercase font-medium">Posted</span>
                            <span className="font-semibold text-emerald-500">
                              {pageItem.posted_posts_count ?? 0}
                            </span>
                          </div>
                          <div>
                            <span className="block text-muted-foreground text-[9px] uppercase font-medium">Failed</span>
                            <span className="font-semibold text-red-500">
                              {pageItem.failed_posts_count ?? 0}
                            </span>
                          </div>
                        </div>


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
                              <span className="font-medium text-foreground">{fbAccount.fb_user_name}</span>
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

          {sortedPages.length > PAGES_PAGE_SIZE && (
            <div className="flex items-center justify-center gap-4 py-4">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => {
                  const newPage = Math.max(1, currentPage - 1)
                  setPage(newPage)
                  updateFiltersUrl({ page: newPage })
                }}
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
                onClick={() => {
                  const newPage = Math.min(totalPages, currentPage + 1)
                  setPage(newPage)
                  updateFiltersUrl({ page: newPage })
                }}
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
