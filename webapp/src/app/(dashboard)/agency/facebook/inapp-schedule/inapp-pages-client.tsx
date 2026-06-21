'use client'

import { useMemo, useState } from 'react'
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
import { AgencyEmptyState } from '@/components/dashboard/agency'
import { AddInappPageDialog } from './add-inapp-page-dialog'
import { cn } from '@/lib/utils'

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
}

const PAGES_PAGE_SIZE = 9

export function InappPagesClient({ initialPages, agencyId }: { initialPages: InappPage[], agencyId: string }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const filteredPages = useMemo(() => {
    const searchLower = search.toLowerCase()
    return initialPages.filter((p) => {
      const matchesSearch =
        (p.fb_page_name || '').toLowerCase().includes(searchLower) ||
        (p.fb_page_id || '').toLowerCase().includes(searchLower)
      return matchesSearch
    })
  }, [initialPages, search])

  const totalPages = Math.max(1, Math.ceil(filteredPages.length / PAGES_PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginatedPages = filteredPages.slice(
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
                  {filteredPages.length} {filteredPages.length === 1 ? 'page' : 'pages'}
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
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  resetPage()
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
                                  <span className={cn(
                                    "inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold border uppercase tracking-wider shrink-0",
                                    pageItem.status === 'active'
                                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                      : "bg-destructive/10 text-destructive border-destructive/20"
                                  )}>
                                    {pageItem.status.replace('_', ' ')}
                                  </span>
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
                        <div className="mb-4 grid grid-cols-2 gap-4 rounded-xl border border-border/50 bg-background/20 p-3 text-xs">
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

          {filteredPages.length > PAGES_PAGE_SIZE && (
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
