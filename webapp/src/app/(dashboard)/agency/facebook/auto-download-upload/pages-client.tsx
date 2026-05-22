'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search, Facebook, Instagram, Youtube, ChevronRight, Music } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { DeletePageDialog } from './delete-page-dialog'
import { PageWithReels } from '@/types/app.types'
import { cn } from '@/lib/utils'
import { Users } from 'lucide-react'
import { formatPageAddedDate, formatPageAge } from '@/lib/page-age'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AgencyEmptyState,
  AgencyInlineStatus,
  AgencySectionCard,
} from '@/components/dashboard/agency'

export function PagesClient({ initialPages }: { initialPages: PageWithReels[] }) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [statusFilter, setStatusFilter] = useState('all')

  const pages = initialPages

  const filteredPages = pages.filter(page => {
    const searchLower = search.toLowerCase()
    const matchesSearch = (
      (page.page_name || '').toLowerCase().includes(searchLower) ||
      (page.fb_page_id || '').toLowerCase().includes(searchLower) ||
      (page.source_username || '').toLowerCase().includes(searchLower)
    )

    const matchesStatus = statusFilter === 'all' || page.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const sortedPages = [...filteredPages].sort((a, b) => {
    switch (sortBy) {
      case 'followers_desc':
        return (b.followers_gained || 0) - (a.followers_gained || 0)
      case 'followers_asc':
        return (a.followers_gained || 0) - (b.followers_gained || 0)
      default: // newest
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    }
  })

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex items-center space-x-2 max-w-4xl">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search pages or sources..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl border-border bg-card pl-9 text-xs font-medium transition-all focus:border-primary/50"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="fb_verification_required">Verification Req.</SelectItem>
            <SelectItem value="invalid_token">Invalid Token</SelectItem>
            <SelectItem value="invalid_username">Invalid Username</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="followers_desc">Most Followers</SelectItem>
            <SelectItem value="followers_asc">Least Followers</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {sortedPages.length === 0 ? (
        <AgencyEmptyState
          icon={<Facebook className="h-6 w-6" />}
          title="No pages found"
          description={
            search
              ? 'No pages match your search criteria.'
              : 'Connect a Facebook account and add your first page to start automation.'
          }
          action={search ? { label: 'Clear search', onClick: () => setSearch('') } : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedPages.map((page) => {
            const postedCount = page.posted_reels_count || 0
            const pendingCount = page.pending_reels_count || 0
            const failedCount = page.failed_reels_count || 0
            const currentFollowers = page.followers_gained || 0
            const startingFollowers = page.followers_count || 0
            const followersDelta = currentFollowers - startingFollowers
            const addedDate = formatPageAddedDate(page.created_at)
            const pageAge = formatPageAge(page.created_at)
            const pageStatus = page.status ?? 'inactive'
            const sourceIdentity = page.source_platform === 'facebook'
              ? page.source_username
              : `@${page.source_username}`

            return (
              <div key={page.id} className="group relative">
                <Link
                  href={`/agency/facebook/auto-download-upload/${page.id}`}
                  className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <AgencySectionCard className="h-full overflow-hidden group-hover:border-primary/25 group-hover:shadow-md">
                    <div className={cn(
                      "absolute top-0 left-0 w-1.5 h-full transition-colors",
                      pageStatus === 'active' ? "bg-primary" : "bg-muted-foreground/20"
                    )} />

                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 min-w-0 flex-1">
                          <CardTitle className="text-xl group-hover:text-primary transition-colors truncate">
                            {page.page_name}
                          </CardTitle>
                          <CardDescription className="pt-1 font-mono text-xs uppercase tracking-wide">
                            ID: {page.fb_page_id}
                          </CardDescription>
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <div className="rounded-md border border-border bg-background/50 px-2 py-1">
                              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Followers</div>
                              <div className="flex items-center gap-1 text-sm font-bold text-primary">
                                <Users className="h-3.5 w-3.5" />
                                <span>{currentFollowers.toLocaleString()}</span>
                              </div>
                            </div>
                            <div className="rounded-md border border-border bg-background/50 px-2 py-1">
                              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Followers Gained</div>
                              <div className={cn(
                                "text-sm font-bold",
                                followersDelta >= 0 ? "text-primary" : "text-destructive"
                              )}>
                                {followersDelta > 0 ? '+' : ''}{followersDelta.toLocaleString()}
                              </div>
                            </div>
                          </div>
                          <div className="text-xs font-semibold tracking-wide text-muted-foreground">
                            Starting followers: {startingFollowers.toLocaleString()}
                          </div>
                          <div className="text-xs tracking-wide text-muted-foreground">
                            Added {addedDate} • Live for {pageAge}
                          </div>

                        </div>
                        <div className="flex flex-col items-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <AgencyInlineStatus
                            label={pageStatus.replace(/_/g, ' ')}
                            tone={pageStatus === 'active' ? 'default' : 'muted'}
                            className="text-[11px]"
                          />
                          {page.fb_page_image ? (
                            <div className="relative h-10 w-10 overflow-hidden rounded-lg border border-border shadow-sm transition-transform group-hover:scale-105">
                              <Image
                                src={page.fb_page_image}
                                alt={page.page_name}
                                fill
                                className="object-cover"
                                unoptimized
                              />
                            </div>
                          ) : (
                            <div className="h-10 w-10 rounded-lg border border-border bg-muted flex items-center justify-center">
                              <Facebook className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors transform group-hover:translate-x-1" />
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* Sync Source Info */}
                      <div className="flex items-center justify-between rounded-lg bg-muted/30 p-2 text-xs">
                        <div className="flex items-center text-muted-foreground">
                          {page.source_platform === 'instagram' && <Instagram className="mr-1.5 h-3.5 w-3.5 text-primary/80" />}
                          {page.source_platform === 'youtube' && <Youtube className="mr-1.5 h-3.5 w-3.5 text-primary/80" />}
                          {page.source_platform === 'tiktok' && <Music className="mr-1.5 h-3.5 w-3.5 text-primary/80" />}
                          {page.source_platform === 'facebook' && <Facebook className="mr-1.5 h-3.5 w-3.5 text-primary/80" />}
                          <span className="font-medium text-foreground">{sourceIdentity}</span>
                        </div>
                        <Badge
                          variant={page.sync_status === 'error' ? "destructive" : "outline"}
                          className={cn(
                            "bg-background text-[11px] font-normal lowercase",
                            page.sync_status === 'error' && "bg-destructive text-destructive-foreground border-none"
                          )}
                        >
                          {page.sync_status === 'error' ? "unable to find the username please check if the username exists" : page.sync_status}
                        </Badge>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="flex flex-col items-center justify-center p-2 rounded-lg border border-border bg-background/50">
                          <span className="text-lg font-bold text-primary leading-none">{postedCount}</span>
                          <span className="mt-1 text-[11px] uppercase font-semibold tracking-tight text-muted-foreground">Posted</span>
                        </div>
                        <div className="flex flex-col items-center justify-center p-2 rounded-lg border border-border bg-background/50">
                          <span className="text-lg font-bold text-foreground leading-none">{pendingCount}</span>
                          <span className="mt-1 text-[11px] uppercase font-semibold tracking-tight text-muted-foreground">Pending</span>
                        </div>
                        <div className="flex flex-col items-center justify-center p-2 rounded-lg border border-border bg-background/50">
                          <span className="text-lg font-bold text-destructive leading-none">{failedCount}</span>
                          <span className="mt-1 text-[11px] uppercase font-semibold tracking-tight text-muted-foreground">Failed</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end pt-2" onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}>
                        <DeletePageDialog
                          pageId={page.id}
                          pageName={page.page_name}
                        />
                      </div>
                    </CardContent>
                  </AgencySectionCard>
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
