'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ChevronRight, Facebook, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { NonActivePageTone } from './dashboard-overview-utils'

export type NonActivePageListItem = {
  id: string
  page_name: string
  fb_page_image: string | null
  reason: string
  tone: NonActivePageTone
}

type TabId = 'all' | 'needs_fix' | 'completed'

const ADU_HUB = '/agency/facebook/auto-download-upload'

export function NeedsAttentionListClient({
  pages,
  totalCount,
}: {
  pages: NonActivePageListItem[]
  totalCount: number
}) {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<TabId>('all')

  const filtered = useMemo(() => {
    let list = pages
    if (tab === 'needs_fix') list = list.filter((p) => p.tone === 'destructive')
    if (tab === 'completed') list = list.filter((p) => p.tone === 'success')
    const q = query.trim().toLowerCase()
    if (q) list = list.filter((p) => p.page_name.toLowerCase().includes(q))
    return list.slice(0, 5)
  }, [pages, query, tab])

  const tabs: { id: TabId; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'needs_fix', label: 'Needs fix' },
    { id: 'completed', label: 'Completed' },
  ]

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search pages…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border border-border/50 bg-background/30 p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                tab === t.id
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">Click a page to see details</p>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pages match this filter.</p>
      ) : (
        <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {filtered.map((page, index) => {
            const isCompleted = page.tone === 'success'
            return (
              <li key={page.id}>
                <Link
                  href={`${ADU_HUB}/${page.id}`}
                  className={cn(
                    'group flex items-center gap-3 rounded-lg border bg-background/30 px-4 py-3 text-sm transition-colors hover:bg-background/50',
                    isCompleted
                      ? 'border-green-500/25 hover:border-green-500/40'
                      : 'border-border/50 hover:border-destructive/30',
                  )}
                >
                  {page.fb_page_image ? (
                    <Image
                      src={page.fb_page_image}
                      alt=""
                      width={40}
                      height={40}
                      className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-border/50"
                      unoptimized
                      priority={index < 2}
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted ring-1 ring-border/50">
                      <Facebook className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                    {page.page_name}
                  </span>
                  <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
                    <span
                      className={cn(
                        'text-xs font-semibold',
                        isCompleted
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-destructive',
                      )}
                    >
                      {page.reason}
                    </span>
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground group-hover:text-foreground">
                      Click to see details
                      <ChevronRight className="h-3 w-3 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100" />
                    </span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {totalCount > 5 ? (
        <Link
          href={ADU_HUB}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          View all on ADU hub
          <ChevronRight className="h-3 w-3" />
        </Link>
      ) : null}
    </div>
  )
}
