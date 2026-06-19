'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import * as SelectPrimitive from '@radix-ui/react-select'

import {
  Search, Trash2, Calendar as CalendarIcon, Filter, Image as ImageIcon, Video,
  FileText, CheckCircle2, AlertCircle, Loader2,
  RefreshCw, X, ArrowRight, ChevronDown, CheckSquare, Layers, Facebook, Check
} from 'lucide-react'

import { HubActionPendingOverlay } from '@/components/dashboard/hub-action-pending-overlay'
import { AgencyEmptyState } from '@/components/dashboard/agency'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { FacebookAccount, FacebookGraphPage } from '@/types/app.types'

type ContentType = 'posts' | 'photos' | 'reels'
type SortType = 'oldest_first' | 'newest_first'

type PageToolsContentItem = {
  id: string
  type: ContentType
  title: string
  created_time: string | null
  permalink_url: string | null
  preview_image_url: string | null
}

type ContentResponse = {
  items: PageToolsContentItem[]
  paging: { cursors?: { after?: string }; next?: string } | null
}

type BatchDeleteResult = {
  total: number
  succeeded: number
  failed: number
  results: Array<{ id: string; success: boolean; error?: string }>
}

type RunProgress = {
  total: number
  processed: number
  succeeded: number
  failed: number
  elapsedSeconds: number
  etaSeconds: number
  currentBatch: number
  totalBatches: number
  waitingSeconds: number
  status: string
}

const CLIENT_BATCH_SIZE = 20
const CLIENT_BATCH_PAUSE_SECONDS = 60

function formatDuration(seconds: number) {
  const clamped = Math.max(0, Math.floor(seconds))
  const mins = Math.floor(clamped / 60)
  const secs = clamped % 60
  return `${mins}m ${secs}s`
}

function toIsoDayStart(date?: Date) {
  if (!date) return undefined
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy.toISOString()
}

function toIsoDayEnd(date?: Date) {
  if (!date) return undefined
  const copy = new Date(date)
  copy.setHours(23, 59, 59, 999)
  return copy.toISOString()
}

function getAfterCursorFromPaging(paging: ContentResponse['paging']) {
  if (paging?.cursors?.after) return paging.cursors.after
  if (!paging?.next) return null
  try {
    const parsed = new URL(paging.next)
    return parsed.searchParams.get('after')
  } catch {
    return null
  }
}

// Custom UI Components
function DatePicker({ date, setDate, label }: { date: Date | undefined, setDate: (d: Date | undefined) => void, label: string }) {
  const [open, setOpen] = useState(false)
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button className="flex h-12 w-full items-center justify-between rounded-xl border border-border/50 bg-background/50 px-4 text-sm transition-all hover:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20">
          <div className="flex flex-col items-start gap-0.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
            <span className={date ? 'text-foreground' : 'text-muted-foreground'}>
              {date ? format(date, 'PPP') : 'Pick a date'}
            </span>
          </div>
          <CalendarIcon className="h-4 w-4 text-muted-foreground opacity-50" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          className="z-50 w-auto rounded-2xl border border-border/50 bg-card/95 p-3 text-popover-foreground shadow-2xl backdrop-blur-xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
          sideOffset={4}
        >
          <DayPicker
            mode="single"
            selected={date}
            onSelect={(d) => {
              setDate(d)
              setOpen(false)
            }}
            className="p-3"
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

function CustomSelect({ value, onChange, options, label }: { value: string, onChange: (val: string) => void, options: { label: string, value: string }[], label: string }) {
  const selectedLabel = options.find(o => o.value === value)?.label
  return (
    <SelectPrimitive.Root value={value} onValueChange={onChange}>
      <SelectPrimitive.Trigger className="flex h-12 w-full items-center justify-between rounded-xl border border-border/50 bg-background/50 px-4 text-sm transition-all hover:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20">
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
          <SelectPrimitive.Value>{selectedLabel}</SelectPrimitive.Value>
        </div>
        <SelectPrimitive.Icon>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="z-50 relative overflow-hidden rounded-xl border border-border/50 bg-card/95 text-popover-foreground shadow-2xl backdrop-blur-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
          position="popper"
          sideOffset={8}
        >
          <SelectPrimitive.Viewport className="p-2">
            {options.map(opt => (
              <SelectPrimitive.Item
                key={opt.value}
                value={opt.value}
                className="relative flex w-full cursor-default select-none items-center rounded-lg py-2 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 hover:bg-muted/50"
              >
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                  <SelectPrimitive.ItemIndicator>
                    <Check className="h-4 w-4" />
                  </SelectPrimitive.ItemIndicator>
                </span>
                <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

export function PageToolsClient() {
  const [accounts, setAccounts] = useState<FacebookAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [hasLoadedAccounts, setHasLoadedAccounts] = useState(false)

  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [selectedAccount, setSelectedAccount] = useState<FacebookAccount | null>(null)

  const [pages, setPages] = useState<FacebookGraphPage[]>([])
  const [loadingPages, setLoadingPages] = useState(false)
  const [selectedPage, setSelectedPage] = useState<FacebookGraphPage | null>(null)

  const [accountSearch, setAccountSearch] = useState('')
  const [pageSearch, setPageSearch] = useState('')

  // Workspace Modes
  const [viewMode, setViewMode] = useState<'smart' | 'manual'>('smart')

  // Smart Filter State
  const [deleteType, setDeleteType] = useState<ContentType>('posts')
  const [deleteSort, setDeleteSort] = useState<SortType>('oldest_first')
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)

  const [previewItems, setPreviewItems] = useState<PageToolsContentItem[]>([])
  const [previewTotal, setPreviewTotal] = useState(0)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewSelectedIds, setPreviewSelectedIds] = useState<string[]>([])
  const [previewPage, setPreviewPage] = useState(1)

  // Manual Curation State
  const [browseType, setBrowseType] = useState<ContentType>('posts')
  const [browseItems, setBrowseItems] = useState<PageToolsContentItem[]>([])
  const [browseSelectedIds, setBrowseSelectedIds] = useState<string[]>([])
  const [browseAfterCursor, setBrowseAfterCursor] = useState<string | null>(null)
  const browseAfterCursorRef = useRef<string | null>(null)

  useEffect(() => {
    browseAfterCursorRef.current = browseAfterCursor
  }, [browseAfterCursor])

  const [loadingBrowse, setLoadingBrowse] = useState(false)
  const [browsePage, setBrowsePage] = useState(1)

  // Execution State
  const [runProgress, setRunProgress] = useState<RunProgress | null>(null)
  const [runFailures, setRunFailures] = useState<Array<{ id: string; error: string }>>([])
  const [showFailureDetails, setShowFailureDetails] = useState(false)
  const [runInProgress, setRunInProgress] = useState(false)

  const loadBrowseContent = useCallback(async (type: ContentType, reset: boolean) => {
    if (!selectedAccountId || !selectedPage) return
    setLoadingBrowse(true)
    try {
      const cursor = reset ? null : browseAfterCursorRef.current
      const cursorPart = cursor ? `&after=${encodeURIComponent(cursor)}` : ''
      const response = await fetch(
        `/api/v1/agency/page-tools/accounts/${selectedAccountId}/pages/${selectedPage.id}/content?type=${type}&limit=25${cursorPart}`,
        {
          headers: selectedPage.access_token ? { 'x-page-access-token': selectedPage.access_token } : {},
        }
      )
      const data = (await response.json()) as ContentResponse & { error?: string }
      if (!response.ok) throw new Error(data.error || 'Failed to load page content')
      const incoming = data.items || []
      setBrowseItems((prev) => (reset ? incoming : [...prev, ...incoming]))
      if (reset) setBrowseSelectedIds([])
      const nextCursor = getAfterCursorFromPaging(data.paging)
      setBrowseAfterCursor(nextCursor)
    } catch {
      toast.error('Unable to load page content')
    } finally {
      setLoadingBrowse(false)
    }
  }, [selectedAccountId, selectedPage])

  useEffect(() => {
    if (selectedPage && selectedAccountId && viewMode === 'manual') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadBrowseContent(browseType, true)
    }
  }, [selectedPage, selectedAccountId, viewMode, browseType, loadBrowseContent])

  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true)
    try {
      const response = await fetch('/api/v1/agency/facebook/accounts')
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to load accounts')
      setAccounts(data.accounts || [])
      setHasLoadedAccounts(true)
    } catch (error) {
      toast.error('Unable to load Facebook accounts', {
        description: error instanceof Error ? error.message : 'Unexpected error',
      })
    } finally {
      setLoadingAccounts(false)
    }
  }, [])

  async function loadPagesForAccount(accountId: string) {
    if (!accountId) return
    setLoadingPages(true)
    try {
      const response = await fetch(`/api/v1/agency/facebook/accounts/${accountId}/pages`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to load pages')
      setPages(data.pages || [])
    } catch {
      toast.error('Unable to load managed pages')
      setPages([])
    } finally {
      setLoadingPages(false)
    }
  }

  function handleSelectAccount(account: FacebookAccount) {
    setSelectedAccountId(account.id)
    setSelectedAccount(account)
    setSelectedPage(null)
    setPages([])
    void loadPagesForAccount(account.id)
  }

  function handleSelectPage(page: FacebookGraphPage) {
    setSelectedPage(page)
    setShowPreview(false)
    setPreviewItems([])
    setBrowseItems([])
    setBrowseSelectedIds([])
    setPreviewPage(1)
    setBrowsePage(1)
    setRunProgress(null)
  }

  function clearSelection() {
    setSelectedAccount(null)
    setSelectedAccountId('')
    setSelectedPage(null)
    setPages([])
    setShowPreview(false)
    setRunProgress(null)
  }

  async function handlePreviewTargets() {
    if (!selectedAccountId || !selectedPage) return
    if (dateFrom && dateTo && dateFrom > dateTo) {
      toast.error('Invalid date range', { description: 'From date must be before To date.' })
      return
    }

    setPreviewLoading(true)
    setShowPreview(true)
    setPreviewItems([])
    try {
      const response = await fetch('/api/v1/agency/page-tools/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          accountId: selectedAccountId,
          pageId: selectedPage.id,
          type: deleteType,
          sort: deleteSort,
          dateFrom: toIsoDayStart(dateFrom),
          dateTo: toIsoDayEnd(dateTo),
          pageAccessToken: selectedPage.access_token,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to preview targets')

      setPreviewItems(data.candidates || [])
      setPreviewTotal(data.total || (data.candidates || []).length)
      setPreviewSelectedIds((data.candidates || []).map((i: PageToolsContentItem) => i.id))
      setPreviewPage(1)
      if (data.candidates?.length === 0) {
        toast.info('No items found matching criteria')
      }
    } catch (error) {
      toast.error('Preview failed', {
        description: error instanceof Error ? error.message : 'Unexpected error',
      })
      setShowPreview(false)
    } finally {
      setPreviewLoading(false)
    }
  }

  async function waitOneSecond() {
    await new Promise<void>((resolve) => setTimeout(resolve, 1000))
  }

  async function executeBulkDelete(targetIds: string[]) {
    if (!selectedAccountId || !selectedPage) return

    setRunInProgress(true)
    setRunFailures([])
    setShowFailureDetails(false)
    const startedAt = Date.now()

    const totalBatches = Math.ceil(targetIds.length / CLIENT_BATCH_SIZE)

    setRunProgress({
      total: targetIds.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      elapsedSeconds: 0,
      etaSeconds: 0,
      currentBatch: 0,
      totalBatches,
      waitingSeconds: 0,
      status: 'Initializing deletion...',
    })

    try {
      let processed = 0
      let succeeded = 0
      let failed = 0

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex += 1) {
        const batchIds = targetIds.slice(batchIndex * CLIENT_BATCH_SIZE, (batchIndex + 1) * CLIENT_BATCH_SIZE)

        setRunProgress((prev) => ({
          total: targetIds.length,
          processed: prev?.processed || 0,
          succeeded: prev?.succeeded || 0,
          failed: prev?.failed || 0,
          elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000),
          etaSeconds: prev?.etaSeconds || 0,
          currentBatch: batchIndex + 1,
          totalBatches,
          waitingSeconds: 0,
          status: `Deleting batch ${batchIndex + 1} of ${totalBatches}...`,
        }))

        const deleteResponse = await fetch('/api/v1/agency/page-tools/batch-delete', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            accountId: selectedAccountId,
            pageAccessToken: selectedPage.access_token,
            contentIds: batchIds,
          }),
        })
        const deleteData = (await deleteResponse.json()) as BatchDeleteResult & { error?: string }
        if (!deleteResponse.ok) throw new Error(deleteData.error || 'Batch delete failed')

        processed += deleteData.total || 0
        succeeded += deleteData.succeeded || 0
        failed += deleteData.failed || 0

        const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000)
        const remaining = targetIds.length - processed
        const rate = processed > 0 ? elapsedSeconds / processed : 0
        const etaSeconds = Math.max(0, Math.round(remaining * rate + (totalBatches - batchIndex - 1) * CLIENT_BATCH_PAUSE_SECONDS))

        setRunProgress({
          total: targetIds.length,
          processed,
          succeeded,
          failed,
          elapsedSeconds,
          etaSeconds,
          currentBatch: batchIndex + 1,
          totalBatches,
          waitingSeconds: 0,
          status: `Batch ${batchIndex + 1} completed`,
        })

        const failedRows = (deleteData.results || [])
          .filter((item) => !item.success)
          .map((item) => ({ id: item.id, error: (item.error && item.error.includes('(#200)')) ? 'Failed to delete' : (item.error || 'Delete failed') }))
        if (failedRows.length) setRunFailures((prev) => [...prev, ...failedRows])

        const hasMore = batchIndex < totalBatches - 1
        if (hasMore) {
          for (let wait = CLIENT_BATCH_PAUSE_SECONDS; wait > 0; wait -= 1) {
            const nowElapsed = Math.floor((Date.now() - startedAt) / 1000)
            const dynamicRate = processed > 0 ? nowElapsed / processed : 0
            const dynamicRemaining = targetIds.length - processed
            const dynamicEta = Math.max(
              wait,
              Math.round(dynamicRemaining * dynamicRate + (totalBatches - batchIndex - 2) * CLIENT_BATCH_PAUSE_SECONDS + wait)
            )
            setRunProgress((prev) =>
              prev
                ? {
                  ...prev,
                  elapsedSeconds: nowElapsed,
                  etaSeconds: dynamicEta,
                  waitingSeconds: wait,
                  status: `API limits reached. Waiting ${wait}s...`,
                }
                : prev
            )
            await waitOneSecond()
          }
        }
      }

      toast.success('Bulk delete completed', {
        description: `${succeeded} deleted, ${failed} failed.`,
      })

      // Refresh content
      setShowPreview(false)
      setPreviewItems([])
      setBrowseSelectedIds([])
      if (viewMode === 'manual') {
        await loadBrowseContent(browseType, true)
      }

    } catch (error) {
      toast.error('Bulk delete failed', {
        description: error instanceof Error ? error.message : 'Unexpected error',
      })
    } finally {
      setRunInProgress(false)
    }
  }

  const filteredAccounts = useMemo(() => {
    const needle = accountSearch.trim().toLowerCase()
    if (!needle) return accounts
    return accounts.filter((item) => String(item.fb_user_name || '').toLowerCase().includes(needle))
  }, [accountSearch, accounts])

  const filteredPages = useMemo(() => {
    const needle = pageSearch.trim().toLowerCase()
    if (!needle) return pages
    return pages.filter((item) => item.name.toLowerCase().includes(needle))
  }, [pageSearch, pages])

  const progressPercent = runProgress?.total ? Math.round((runProgress.processed / runProgress.total) * 100) : 0

  useEffect(() => {
    const t = setTimeout(() => {
      void loadAccounts()
    }, 0)
    return () => clearTimeout(t)
  }, [loadAccounts])

  if (hasLoadedAccounts && !loadingAccounts && accounts.length === 0) {
    return (
      <AgencyEmptyState
        icon={<Facebook className="h-7 w-7" />}
        title="No Facebook accounts connected"
        description="Connect a Facebook account to use bulk delete on your pages."
        actionHref={{
          label: 'Go to FB Accounts',
          href: '/agency/facebook/accounts',
        }}
      />
    )
  }

  const workspaceLoading = previewLoading || loadingBrowse

  // ---------------------------------------------------------------------------
  // RENDER HELPERS
  // ---------------------------------------------------------------------------

  const renderContentCard = (item: PageToolsContentItem, isSelected: boolean, onToggle: () => void) => (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      key={item.id}
      className={`group relative overflow-hidden rounded-xl border transition-all hover:shadow-lg cursor-pointer ${isSelected ? 'ring-2 ring-primary border-primary hover:border-primary' : 'border-border/50 hover:border-primary/50 bg-card/50 backdrop-blur-sm'}`}
      onClick={onToggle}
    >
      <div className="aspect-square w-full relative bg-muted/20 overflow-hidden">
        {item.preview_image_url ? (
          <Image src={item.preview_image_url} alt={item.title} fill className="object-cover transition-transform duration-500 group-hover:scale-110" unoptimized />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            {item.type === 'posts' ? <FileText size={32} className="opacity-20" /> : item.type === 'photos' ? <ImageIcon size={32} className="opacity-20" /> : <Video size={32} className="opacity-20" />}
          </div>
        )}
        <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${isSelected ? 'opacity-100' : ''}`} />

        <div className="absolute top-3 left-3 z-10">
          <div className={`rounded-full p-0.5 transition-colors ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-background/80 text-muted-foreground backdrop-blur-md opacity-0 group-hover:opacity-100'}`}>
            {isSelected ? <CheckCircle2 size={20} /> : <div className="h-5 w-5 rounded-full border-2 border-current m-0.5" />}
          </div>
        </div>

        <div className={`absolute bottom-0 left-0 right-0 p-4 translate-y-2 transition-all duration-300 group-hover:translate-y-0 ${isSelected ? 'translate-y-0' : ''}`}>
          <Badge variant="secondary" className="mb-2 bg-background/50 backdrop-blur-md border-none text-[10px] uppercase tracking-wider text-foreground">
            {item.type}
          </Badge>
          <p className="text-sm font-medium text-white line-clamp-2 leading-tight drop-shadow-md">{item.title}</p>
          <p className="text-xs text-white/70 mt-1 drop-shadow-md">{item.created_time ? new Date(item.created_time).toLocaleDateString() : 'Unknown date'}</p>
        </div>
      </div>
    </motion.div>
  )

  return (
    <div className="min-h-[80vh] w-full max-w-7xl mx-auto flex flex-col relative pb-32">

      {/* HEADER / SELECTION AREA */}
      <AnimatePresence mode="wait">
        {!selectedPage ? (
          <motion.div
            key="selection-wizard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
            className="flex-1 flex flex-col items-center justify-center py-20"
          >
            <div className="w-full max-w-2xl space-y-8">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-primary ring-1 ring-primary/20 shadow-[0_0_40px_-10px_rgba(var(--primary),0.3)]">
                  <Layers size={32} />
                </div>
                <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/50 bg-clip-text text-transparent">Connect & Select</h1>
                <p className="text-lg text-muted-foreground">Select a Facebook account and page to begin bulk deletion.</p>
              </div>

              {!selectedAccount ? (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-blue-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative bg-card/40 backdrop-blur-xl border border-border/50 rounded-2xl p-6 shadow-2xl">
                      <HubActionPendingOverlay
                        show={loadingAccounts}
                        message="Loading accounts…"
                      />
                      <div className="flex items-center gap-3 mb-6">
                        <Facebook className="text-blue-500" />
                        <h2 className="text-xl font-semibold">Select Account</h2>
                      </div>
                      <div className="relative mb-6">
                        <Search className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          className="pl-11 h-12 bg-background/50 border-border/50 rounded-xl"
                          placeholder="Search accounts..."
                          value={accountSearch}
                          onChange={(e) => setAccountSearch(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {!hasLoadedAccounts || loadingAccounts ? (
                          <div className="flex flex-col items-center justify-center gap-4 p-8">
                            <p className="text-center text-sm text-muted-foreground">
                              Loading your connected accounts…
                            </p>
                            <Loader2 className="animate-spin text-muted-foreground" />
                          </div>
                        ) : filteredAccounts.length === 0 ? (
                          <div className="text-center p-8 text-muted-foreground">
                            No accounts match your search
                          </div>
                        ) : (
                          filteredAccounts.map((acc) => (
                            <button
                              key={acc.id}
                              onClick={() => handleSelectAccount(acc)}
                              className="w-full flex items-center gap-4 p-4 rounded-xl border border-transparent hover:border-border hover:bg-muted/30 transition-all text-left group"
                            >
                              {acc.fb_user_image ? (
                                <Image src={acc.fb_user_image} alt={acc.fb_user_name || ''} width={48} height={48} className="rounded-full shadow-sm ring-2 ring-transparent group-hover:ring-primary/20 transition-all" unoptimized />
                              ) : (
                                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                                  <Facebook size={24} className="text-muted-foreground" />
                                </div>
                              )}
                              <div>
                                <p className="font-semibold text-lg">{acc.fb_user_name}</p>
                                <p className="text-sm text-muted-foreground font-mono">{acc.fb_user_id}</p>
                              </div>
                              <ArrowRight className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-blue-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative bg-card/40 backdrop-blur-xl border border-border/50 rounded-2xl p-6 shadow-2xl">
                      <HubActionPendingOverlay show={loadingPages} message="Loading pages…" />
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <Layers className="text-primary" />
                          <h2 className="text-xl font-semibold">Select Page</h2>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedAccount(null)} className="text-muted-foreground hover:text-foreground">
                          Back
                        </Button>
                      </div>
                      <div className="relative mb-6">
                        <Search className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          className="pl-11 h-12 bg-background/50 border-border/50 rounded-xl"
                          placeholder="Search pages..."
                          value={pageSearch}
                          onChange={(e) => setPageSearch(e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {loadingPages ? (
                          <div className="col-span-2 flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
                        ) : filteredPages.length === 0 ? (
                          pages.length === 0 ? (
                            <div className="col-span-2">
                              <AgencyEmptyState
                                icon={<Layers className="h-7 w-7" />}
                                title="No pages on this account"
                                description="This Facebook account has no managed pages available for bulk delete."
                                actionHref={{
                                  label: 'Go to FB Accounts',
                                  href: '/agency/facebook/accounts',
                                }}
                              />
                            </div>
                          ) : (
                            <div className="col-span-2 p-8 text-center text-muted-foreground">
                              No pages match your search
                            </div>
                          )
                        ) : (
                          filteredPages.map((page) => (
                            <button
                              key={page.id}
                              onClick={() => handleSelectPage(page)}
                              className="flex flex-col items-start p-4 rounded-xl border border-border/50 bg-background/30 hover:bg-muted/50 hover:border-primary/50 transition-all text-left group"
                            >
                              {page.picture ? (
                                <Image src={page.picture} alt={page.name} width={40} height={40} className="rounded-lg mb-3 shadow-sm" unoptimized />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-3">
                                  <Layers size={20} className="text-muted-foreground" />
                                </div>
                              )}
                              <p className="font-semibold line-clamp-1">{page.name}</p>
                              <p className="text-xs text-muted-foreground font-mono mt-1">{page.id}</p>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="active-connection"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b pb-4 pt-6 mb-8 -mx-6 px-6 sm:-mx-8 sm:px-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0"
          >
            <div className="flex items-center gap-4">
              <div className="flex items-center">
                {selectedAccount?.fb_user_image ? (
                  <Image src={selectedAccount.fb_user_image} alt="" width={32} height={32} className="rounded-full ring-2 ring-background z-10 shadow-sm" unoptimized />
                ) : <div className="w-8 h-8 rounded-full bg-muted z-10 ring-2 ring-background" />}

                {selectedPage?.picture ? (
                  <Image src={selectedPage.picture} alt="" width={40} height={40} className="rounded-lg -ml-3 ring-2 ring-background z-20 shadow-md" unoptimized />
                ) : <div className="w-10 h-10 rounded-lg bg-muted -ml-3 ring-2 ring-background z-20" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-lg leading-tight">{selectedPage?.name}</h2>
                  <Badge variant="outline" className="bg-primary/5 text-primary text-[10px] uppercase tracking-wider py-0 px-1.5 h-5">Active</Badge>
                </div>
                <p className="text-sm text-muted-foreground leading-tight mt-0.5">via {selectedAccount?.fb_user_name}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={clearSelection} className="rounded-full border-border/50 hover:bg-destructive/5 hover:text-destructive hover:border-destructive/30 transition-colors">
              Disconnect
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN WORKSPACE */}
      {selectedPage && !runInProgress && !runProgress && (
        <motion.div
          initial={{ opacity: 0, filter: 'blur(10px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          className="relative flex-1 flex flex-col space-y-8"
        >
          <HubActionPendingOverlay
            show={workspaceLoading}
            message="Loading page content…"
            className="rounded-xl"
          />
          {/* SEGMENTED CONTROL */}
          <div className="flex justify-center">
            <div className="bg-muted/50 p-1 rounded-full inline-flex relative shadow-inner border border-border/30 backdrop-blur-sm">
              <div
                className="absolute inset-y-1 rounded-full bg-background shadow-sm transition-all duration-300 ease-out z-0"
                style={{
                  width: 'calc(50% - 4px)',
                  left: viewMode === 'smart' ? '4px' : 'calc(50%)',
                }}
              />
              <button
                className={`relative z-10 flex items-center gap-2 px-4 sm:px-8 py-2.5 text-sm font-medium rounded-full transition-colors ${viewMode === 'smart' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'}`}
                onClick={() => setViewMode('smart')}
              >
                <Filter size={16} />
                Smart Filter
              </button>
              <button
                className={`relative z-10 flex items-center gap-2 px-4 sm:px-8 py-2.5 text-sm font-medium rounded-full transition-colors ${viewMode === 'manual' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'}`}
                onClick={() => setViewMode('manual')}
              >
                <CheckSquare size={16} />
                Manual Curation
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {viewMode === 'smart' ? (
              <motion.div
                key="mode-smart"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8 max-w-4xl mx-auto w-full"
              >
                {/* COMMAND CENTER */}
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent rounded-3xl blur-2xl opacity-50 pointer-events-none" />
                  <div className="relative bg-card border border-border/50 rounded-3xl p-8 shadow-xl">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                        <Filter size={24} />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold">Bulk Delete Criteria</h3>
                        <p className="text-sm text-muted-foreground">Filter posts to delete by date range and type.</p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <div className="space-y-3">
                          <label className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                            <CalendarIcon size={16} className="text-muted-foreground" /> Date Range
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <DatePicker date={dateFrom} setDate={setDateFrom} label="From" />
                            <DatePicker date={dateTo} setDate={setDateTo} label="To" />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="space-y-3">
                          <label className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                            <Layers size={16} className="text-muted-foreground" /> Content Settings
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <CustomSelect
                              value={deleteType}
                              onChange={(v) => setDeleteType(v as ContentType)}
                              label="Type"
                              options={[
                                { label: 'Posts', value: 'posts' },
                                { label: 'Photos', value: 'photos' },
                                { label: 'Reels', value: 'reels' },
                              ]}
                            />
                            <CustomSelect
                              value={deleteSort}
                              onChange={(v) => setDeleteSort(v as SortType)}
                              label="Sort"
                              options={[
                                { label: 'Oldest First', value: 'oldest_first' },
                                { label: 'Newest First', value: 'newest_first' },
                              ]}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-10 pt-6 border-t border-border/50 flex justify-center sm:justify-end">
                      <Button
                        size="lg"
                        className="rounded-full px-8 bg-foreground text-background hover:bg-foreground/90 shadow-xl shadow-foreground/10"
                        onClick={handlePreviewTargets}
                        disabled={previewLoading}
                      >
                        {previewLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Search className="mr-2 h-5 w-5" />}
                        Preview Targets
                      </Button>
                    </div>
                  </div>
                </div>

                {/* PREVIEW RESULTS */}
                <AnimatePresence>
                  {showPreview && (
                    <motion.div
                      initial={{ opacity: 0, y: 40 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 40 }}
                      className="space-y-6"
                    >
                      <div className="flex items-center justify-between px-2">
                        <div>
                          <h3 className="text-2xl font-bold flex items-center gap-3">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary text-sm">{previewTotal}</span>
                            Items Found
                          </h3>
                          <p className="text-muted-foreground mt-1">Previewing matches based on your criteria.</p>
                        </div>
                        {previewItems.length > 0 && (
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => setPreviewSelectedIds(previewItems.map(i => i.id))} className="rounded-full">Select All</Button>
                            <Button variant="outline" size="sm" onClick={() => setPreviewSelectedIds([])} className="rounded-full">Deselect All</Button>
                          </div>
                        )}
                      </div>

                      {previewItems.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {previewItems.slice((previewPage - 1) * 12, previewPage * 12).map((item) => renderContentCard(
                            item,
                            previewSelectedIds.includes(item.id),
                            () => setPreviewSelectedIds(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id])
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-20 border border-dashed rounded-3xl bg-muted/10">
                          <p className="text-muted-foreground">No content matched your filters.</p>
                        </div>
                      )}
                      {previewItems.length > 12 && (
                        <div className="flex justify-center items-center gap-4 py-4">
                          <Button variant="outline" size="sm" onClick={() => setPreviewPage(p => Math.max(1, p - 1))} disabled={previewPage === 1}>Previous</Button>
                          <span className="text-sm text-muted-foreground">Page {previewPage} of {Math.ceil(previewItems.length / 12)}</span>
                          <Button variant="outline" size="sm" onClick={() => setPreviewPage(p => Math.min(Math.ceil(previewItems.length / 12), p + 1))} disabled={previewPage >= Math.ceil(previewItems.length / 12)}>Next</Button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.div
                key="mode-manual"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex flex-wrap bg-muted/50 p-1 rounded-xl border border-border/50 w-full sm:w-auto">
                    {(['posts', 'photos', 'reels'] as ContentType[]).map((type) => (
                      <button
                        key={type}
                        className={`px-6 py-2 rounded-lg text-sm font-medium capitalize transition-all ${browseType === type ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        onClick={() => {
                          setBrowseType(type)
                          setBrowseSelectedIds([])
                          setBrowseAfterCursor(null)
                          setBrowsePage(1)
                        }}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="text-sm text-muted-foreground">
                      {browseSelectedIds.length} selected
                    </p>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setBrowseSelectedIds(browseItems.map(i => i.id))} className="rounded-full">Select All</Button>
                      <Button variant="outline" size="sm" onClick={() => setBrowseSelectedIds([])} className="rounded-full">Deselect All</Button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {browseItems.slice((browsePage - 1) * 20, browsePage * 20).map((item) => renderContentCard(
                    item,
                    browseSelectedIds.includes(item.id),
                    () => {
                      setBrowseSelectedIds(prev =>
                        prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]
                      )
                    }
                  ))}

                  {loadingBrowse && (
                    <div className="col-span-full flex justify-center py-20">
                      <Loader2 className="animate-spin text-muted-foreground" size={32} />
                    </div>
                  )}

                  {!loadingBrowse && browseItems.length === 0 && (
                    <div className="col-span-full text-center py-32 border border-dashed rounded-3xl bg-muted/10">
                      <FileText className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                      <p className="text-lg font-medium">No {browseType} found</p>
                      <p className="text-muted-foreground mt-1">This page doesn&apos;t have any {browseType} to display.</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-center items-center gap-4 mt-12">
                  <Button variant="outline" size="sm" onClick={() => setBrowsePage(p => Math.max(1, p - 1))} disabled={browsePage === 1}>Previous</Button>
                  {browseItems.length > 0 && <span className="text-sm text-muted-foreground">Page {browsePage} of {Math.ceil(browseItems.length / 20)}</span>}
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setBrowsePage(p => Math.min(Math.ceil(browseItems.length / 20), p + 1))} disabled={browsePage >= Math.ceil(browseItems.length / 20) && !browseAfterCursor}>Next</Button>
                    {browseAfterCursor && !loadingBrowse && browsePage >= Math.ceil(browseItems.length / 20) && (
                      <Button variant="ghost" size="sm" onClick={() => {
                        loadBrowseContent(browseType, false).then(() => setBrowsePage(p => p + 1))
                      }} className="rounded-full bg-muted/30 hover:bg-muted/50">
                        <RefreshCw className="mr-2 h-4 w-4" /> Load More
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* FLOATING ACTION BAR FOR BOTH MODES */}
      <AnimatePresence>
        {((viewMode === 'manual' && browseSelectedIds.length > 0) || (viewMode === 'smart' && previewSelectedIds.length > 0)) && !runInProgress && !runProgress && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="bg-foreground/95 backdrop-blur-xl text-background p-3 pl-5 pr-3 rounded-full shadow-2xl flex flex-col sm:flex-row items-center gap-3 sm:gap-6 border border-white/10 text-sm sm:text-base whitespace-nowrap">
              <span className="font-semibold">{viewMode === 'manual' ? browseSelectedIds.length : previewSelectedIds.length} items selected</span>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className="rounded-full text-background hover:text-white hover:bg-white/20"
                  onClick={() => viewMode === 'manual' ? setBrowseSelectedIds([]) : setPreviewSelectedIds([])}
                >
                  <X size={18} />
                </Button>
                <Button
                  className="rounded-full bg-destructive hover:bg-destructive/90 text-white shadow-lg shadow-destructive/20 pl-4 pr-5"
                  onClick={() => executeBulkDelete(viewMode === 'manual' ? browseSelectedIds : previewSelectedIds)}
                >
                  <Trash2 size={16} className="mr-2" /> Delete Selected
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* EXECUTION DASHBOARD */}
      <AnimatePresence>
        {(runInProgress || runProgress) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-0 z-50 bg-background/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 overflow-y-auto"
          >
            <div className="w-full max-w-3xl space-y-12 py-12">
              <div className="text-center space-y-4">
                <h2 className="text-4xl font-bold tracking-tight">Executing Deletion</h2>
                <p className="text-xl text-muted-foreground">{runProgress?.status}</p>
              </div>

              {/* Progress Circle & Core Stats */}
              <div className="flex flex-col items-center justify-center">
                <div className="relative w-64 h-64 flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                    <circle cx="128" cy="128" r="120" className="stroke-muted fill-none" strokeWidth="8" />
                    <motion.circle
                      cx="128" cy="128" r="120"
                      className={`fill-none stroke-linecap-round ${runProgress?.waitingSeconds ? 'stroke-amber-500' : 'stroke-primary'}`}
                      strokeWidth="8"
                      strokeDasharray="753.98"
                      initial={{ strokeDashoffset: 753.98 }}
                      animate={{ strokeDashoffset: 753.98 - (753.98 * progressPercent) / 100 }}
                      transition={{ duration: 0.5, ease: "easeInOut" }}
                    />
                  </svg>
                  <div className="text-center z-10 flex flex-col items-center">
                    {runProgress?.waitingSeconds ? (
                      <>
                        <span className="text-5xl font-bold text-amber-500">{runProgress.waitingSeconds}s</span>
                        <span className="text-sm font-medium text-amber-500/80 uppercase tracking-widest mt-2">API Pause</span>
                      </>
                    ) : progressPercent === 100 ? (
                      <>
                        <CheckCircle2 size={48} className="text-green-500 mb-2" />
                        <span className="text-xl font-bold text-green-500">Complete</span>
                      </>
                    ) : (
                      <>
                        <span className="text-5xl font-bold">{progressPercent}%</span>
                        <span className="text-sm font-medium text-muted-foreground uppercase tracking-widest mt-2">Completed</span>
                      </>
                    )}
                  </div>

                  {runProgress?.waitingSeconds && runProgress.waitingSeconds > 0 && (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-0 rounded-full border-2 border-dashed border-amber-500/30"
                    />
                  )}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-card border border-border/50 rounded-2xl p-6 text-center shadow-lg">
                  <p className="text-sm text-muted-foreground font-medium mb-2 uppercase tracking-wider">Processed</p>
                  <p className="text-3xl font-bold">{runProgress?.processed} <span className="text-lg text-muted-foreground font-normal">/ {runProgress?.total}</span></p>
                </div>
                <div className="bg-card border border-border/50 rounded-2xl p-6 text-center shadow-lg">
                  <p className="text-sm text-muted-foreground font-medium mb-2 uppercase tracking-wider">Succeeded</p>
                  <p className="text-3xl font-bold text-green-500">{runProgress?.succeeded}</p>
                </div>
                <div className="bg-card border border-border/50 rounded-2xl p-6 text-center shadow-lg">
                  <p className="text-sm text-muted-foreground font-medium mb-2 uppercase tracking-wider">Failed</p>
                  <p className={`text-3xl font-bold ${runProgress?.failed ? 'text-destructive' : 'text-foreground'}`}>{runProgress?.failed}</p>
                </div>
                <div className="bg-card border border-border/50 rounded-2xl p-6 text-center shadow-lg">
                  <p className="text-sm text-muted-foreground font-medium mb-2 uppercase tracking-wider">ETA</p>
                  <p className="text-3xl font-bold font-mono">{formatDuration(runProgress?.etaSeconds || 0)}</p>
                </div>
              </div>

              {/* Failures Panel */}
              {runFailures.length > 0 && (
                <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-destructive flex items-center gap-2">
                      <AlertCircle size={18} /> {runFailures.length} Items Failed
                    </h4>
                    <Button variant="outline" size="sm" onClick={() => setShowFailureDetails(!showFailureDetails)} className="border-destructive/30 text-destructive hover:bg-destructive/10">
                      {showFailureDetails ? 'Hide Details' : 'Show Details'}
                    </Button>
                  </div>
                  <AnimatePresence>
                    {showFailureDetails && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar mt-4">
                          {runFailures.map((f, i) => (
                            <div key={i} className="text-sm bg-background/50 rounded-lg p-3 border border-destructive/10 flex flex-col gap-1">
                              <span className="font-mono text-xs text-muted-foreground break-all">{f.id}</span>
                              <span className="text-destructive font-medium">{f.error}</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Action Buttons */}
              {!runInProgress && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center pt-8">
                  <Button size="lg" className="rounded-full px-12 text-lg h-14" onClick={() => {
                    setRunProgress(null)
                    setRunFailures([])
                  }}>
                    Done
                  </Button>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
