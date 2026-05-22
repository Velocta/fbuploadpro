'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { Search, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
const ALL_CONTENT_TYPES: ContentType[] = ['posts', 'photos', 'reels']

function formatDuration(seconds: number) {
  const clamped = Math.max(0, Math.floor(seconds))
  const mins = Math.floor(clamped / 60)
  const secs = clamped % 60
  return `${mins}m ${secs}s`
}

function toIsoDayStart(value: string) {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : undefined
}

function toIsoDayEnd(value: string) {
  return value ? new Date(`${value}T23:59:59.999Z`).toISOString() : undefined
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

export function PageToolsClient() {
  const [accounts, setAccounts] = useState<FacebookAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [selectModalOpen, setSelectModalOpen] = useState(false)
  const [accountSearch, setAccountSearch] = useState('')
  const [pageSearch, setPageSearch] = useState('')
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [selectedAccount, setSelectedAccount] = useState<FacebookAccount | null>(null)
  const [pages, setPages] = useState<FacebookGraphPage[]>([])
  const [selectedPage, setSelectedPage] = useState<FacebookGraphPage | null>(null)
  const [draftAccountId, setDraftAccountId] = useState('')
  const [draftPageId, setDraftPageId] = useState('')

  const [browseType, setBrowseType] = useState<ContentType>('posts')
  const [browseItems, setBrowseItems] = useState<PageToolsContentItem[]>([])
  const [browseSelectedIds, setBrowseSelectedIds] = useState<string[]>([])
  const [browseAfterCursor, setBrowseAfterCursor] = useState<string | null>(null)

  const [deleteType, setDeleteType] = useState<ContentType>('posts')
  const [deleteSort, setDeleteSort] = useState<SortType>('oldest_first')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [runProgress, setRunProgress] = useState<RunProgress | null>(null)
  const [runFailures, setRunFailures] = useState<Array<{ id: string; error: string }>>([])
  const [showFailureDetails, setShowFailureDetails] = useState(false)
  const [runInProgress, setRunInProgress] = useState(false)

  useEffect(() => {
    void loadAccounts()
  }, [])

  useEffect(() => {
    if (!selectedPage || !selectedAccountId) return
    void loadBrowseContent(browseType, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPage, selectedAccountId, browseType])

  async function loadAccounts() {
    setLoading(true)
    try {
      const response = await fetch('/api/v1/agency/facebook/accounts')
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to load accounts')
      setAccounts(data.accounts || [])
    } catch (error) {
      toast.error('Unable to load Facebook accounts', {
        description: error instanceof Error ? error.message : 'Unexpected error',
      })
    } finally {
      setLoading(false)
    }
  }

  async function loadPagesForAccount(accountId: string) {
    if (!accountId) return
    setLoading(true)
    try {
      const response = await fetch(`/api/v1/agency/facebook/accounts/${accountId}/pages`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to load pages')
      setPages(data.pages || [])
    } catch (error) {
      toast.error('Unable to load managed pages', {
        description: error instanceof Error ? error.message : 'Unexpected error',
      })
      setPages([])
    } finally {
      setLoading(false)
    }
  }

  async function loadBrowseContent(type: ContentType, reset: boolean) {
    if (!selectedAccountId || !selectedPage) return
    setLoading(true)
    try {
      const cursorPart = !reset && browseAfterCursor ? `&after=${encodeURIComponent(browseAfterCursor)}` : ''
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
      setBrowseAfterCursor(getAfterCursorFromPaging(data.paging))
    } catch (error) {
      toast.error('Unable to load page content', {
        description: error instanceof Error ? error.message : 'Unexpected error',
      })
    } finally {
      setLoading(false)
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

  async function openSelectPageModal() {
    setSelectModalOpen(true)
    setDraftAccountId(selectedAccountId)
    setDraftPageId(selectedPage?.id || '')
    if (selectedAccountId) await loadPagesForAccount(selectedAccountId)
  }

  async function onDraftAccountChange(accountId: string) {
    setDraftAccountId(accountId)
    setDraftPageId('')
    await loadPagesForAccount(accountId)
  }

  function applyPageSelection() {
    const account = accounts.find((item) => item.id === draftAccountId) || null
    const page = pages.find((item) => item.id === draftPageId) || null
    if (!account || !page) {
      toast.error('Select both account and page')
      return
    }
    setSelectedAccountId(account.id)
    setSelectedAccount(account)
    setSelectedPage(page)
    setBrowseItems([])
    setBrowseSelectedIds([])
    setBrowseAfterCursor(null)
    setRunProgress(null)
    setRunFailures([])
    setShowFailureDetails(false)
    setSelectModalOpen(false)
  }

  async function waitOneSecond() {
    await new Promise<void>((resolve) => setTimeout(resolve, 1000))
  }

  async function fetchCandidateIds(types: ContentType[]) {
    if (!selectedAccountId || !selectedPage) return []
    const all: Array<{ id: string; created_time: string | null }> = []
    for (const type of types) {
      const previewResponse = await fetch('/api/v1/agency/page-tools/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          accountId: selectedAccountId,
          pageId: selectedPage.id,
          type,
          sort: deleteSort,
          dateFrom: toIsoDayStart(dateFrom),
          dateTo: toIsoDayEnd(dateTo),
          pageAccessToken: selectedPage.access_token,
        }),
      })
      const previewData = await previewResponse.json()
      if (!previewResponse.ok) throw new Error(previewData.error || 'Failed to preview candidates')
      for (const item of previewData.candidates || []) {
        all.push({ id: item.id, created_time: item.created_time || null })
      }
    }

    const deduped = Array.from(new Map(all.map((item) => [item.id, item])).values())
    deduped.sort((a, b) => {
      const av = a.created_time ? Date.parse(a.created_time) : 0
      const bv = b.created_time ? Date.parse(b.created_time) : 0
      return deleteSort === 'oldest_first' ? av - bv : bv - av
    })
    return deduped.map((item) => item.id)
  }

  async function runBulkDelete(targetTypes: ContentType[] = [deleteType]) {
    if (!selectedAccountId || !selectedPage) {
      toast.error('Select a Facebook page first')
      return
    }
    if (dateFrom && dateTo && dateFrom > dateTo) {
      toast.error('Invalid date range', { description: 'From date must be before To date.' })
      return
    }

    setRunInProgress(true)
    setRunFailures([])
    setShowFailureDetails(false)
    const startedAt = Date.now()
    setRunProgress({
      total: 0,
      processed: 0,
      succeeded: 0,
      failed: 0,
      elapsedSeconds: 0,
      etaSeconds: 0,
      currentBatch: 0,
      totalBatches: 0,
      waitingSeconds: 0,
      status: 'Preparing delete candidates...',
    })
    try {
      const candidateIds = await fetchCandidateIds(targetTypes)
      if (!candidateIds.length) {
        toast.message('No matching content found', { description: 'Try adjusting type/date filters.' })
        setRunProgress({
          total: 0,
          processed: 0,
          succeeded: 0,
          failed: 0,
          elapsedSeconds: 0,
          etaSeconds: 0,
          currentBatch: 0,
          totalBatches: 0,
          waitingSeconds: 0,
          status: 'No matching content found',
        })
        return
      }

      const totalBatches = Math.ceil(candidateIds.length / CLIENT_BATCH_SIZE)
      let processed = 0
      let succeeded = 0
      let failed = 0
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex += 1) {
        const batchIds = candidateIds.slice(batchIndex * CLIENT_BATCH_SIZE, (batchIndex + 1) * CLIENT_BATCH_SIZE)
        setRunProgress((prev) => ({
          total: candidateIds.length,
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
        const remaining = candidateIds.length - processed
        const rate = processed > 0 ? elapsedSeconds / processed : 0
        const etaSeconds = Math.max(0, Math.round(remaining * rate + (totalBatches - batchIndex - 1) * CLIENT_BATCH_PAUSE_SECONDS))
        setRunProgress({
          total: candidateIds.length,
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
          .map((item) => ({ id: item.id, error: item.error || 'Delete failed' }))
        if (failedRows.length) setRunFailures((prev) => [...prev, ...failedRows])

        const hasMore = batchIndex < totalBatches - 1
        if (hasMore) {
          for (let wait = CLIENT_BATCH_PAUSE_SECONDS; wait > 0; wait -= 1) {
            const nowElapsed = Math.floor((Date.now() - startedAt) / 1000)
            const dynamicRate = processed > 0 ? nowElapsed / processed : 0
            const dynamicRemaining = candidateIds.length - processed
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
                    status: `Waiting ${wait}s before next batch...`,
                  }
                : prev
            )
            await waitOneSecond()
          }
        }
      }

      if (failed > 0) {
        toast.warning('Bulk delete finished with some failures', {
          description: `${succeeded} deleted, ${failed} failed.`,
        })
        setShowFailureDetails(true)
      } else {
        toast.success('Bulk delete completed', {
          description: `${succeeded} item(s) deleted from Facebook (${targetTypes.join(', ')}).`,
        })
      }

      await loadBrowseContent(browseType, true)
    } catch (error) {
      toast.error('Bulk delete failed', {
        description: error instanceof Error ? error.message : 'Unexpected error',
      })
    } finally {
      setRunInProgress(false)
    }
  }

  async function runDeleteFromBrowserSelection() {
    if (!selectedAccountId || !selectedPage) {
      toast.error('Select a Facebook page first')
      return
    }
    if (!browseSelectedIds.length) {
      toast.error('Select at least one item in Live Content Browser')
      return
    }

    setRunInProgress(true)
    setRunFailures([])
    setShowFailureDetails(false)
    const startedAt = Date.now()
    setRunProgress({
      total: browseSelectedIds.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      elapsedSeconds: 0,
      etaSeconds: 0,
      currentBatch: 0,
      totalBatches: Math.ceil(browseSelectedIds.length / CLIENT_BATCH_SIZE),
      waitingSeconds: 0,
      status: 'Starting selected-items delete...',
    })
    try {
      const candidateIds = [...browseSelectedIds]
      const totalBatches = Math.ceil(candidateIds.length / CLIENT_BATCH_SIZE)
      let processed = 0
      let succeeded = 0
      let failed = 0

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex += 1) {
        const batchIds = candidateIds.slice(batchIndex * CLIENT_BATCH_SIZE, (batchIndex + 1) * CLIENT_BATCH_SIZE)
        setRunProgress((prev) => ({
          total: candidateIds.length,
          processed: prev?.processed || 0,
          succeeded: prev?.succeeded || 0,
          failed: prev?.failed || 0,
          elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000),
          etaSeconds: prev?.etaSeconds || 0,
          currentBatch: batchIndex + 1,
          totalBatches,
          waitingSeconds: 0,
          status: `Deleting selected batch ${batchIndex + 1} of ${totalBatches}...`,
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
        const remaining = candidateIds.length - processed
        const rate = processed > 0 ? elapsedSeconds / processed : 0
        const etaSeconds = Math.max(0, Math.round(remaining * rate + (totalBatches - batchIndex - 1) * CLIENT_BATCH_PAUSE_SECONDS))
        setRunProgress({
          total: candidateIds.length,
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
          .map((item) => ({ id: item.id, error: item.error || 'Delete failed' }))
        if (failedRows.length) setRunFailures((prev) => [...prev, ...failedRows])

        const hasMore = batchIndex < totalBatches - 1
        if (hasMore) {
          for (let wait = CLIENT_BATCH_PAUSE_SECONDS; wait > 0; wait -= 1) {
            const nowElapsed = Math.floor((Date.now() - startedAt) / 1000)
            setRunProgress((prev) =>
              prev
                ? { ...prev, elapsedSeconds: nowElapsed, waitingSeconds: wait, status: `Waiting ${wait}s before next batch...` }
                : prev
            )
            await waitOneSecond()
          }
        }
      }

      setBrowseSelectedIds([])
      await loadBrowseContent(browseType, true)
      toast.success('Selected content delete completed')
    } catch (error) {
      toast.error('Delete selected failed', {
        description: error instanceof Error ? error.message : 'Unexpected error',
      })
    } finally {
      setRunInProgress(false)
    }
  }

  const progressPercent = runProgress?.total ? Math.round((runProgress.processed / runProgress.total) * 100) : 0

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-xl border p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold">Bulk Delete</h3>
            <p className="text-xs text-muted-foreground">
              Select a connected Facebook page, filter candidate content, and run client-controlled deletes in timed batches.
            </p>
          </div>
          <Button variant="outline" onClick={() => void openSelectPageModal()}>
            Select Facebook Page
          </Button>
        </div>

        {selectedAccount && selectedPage ? (
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs font-semibold text-muted-foreground">Selected page context</p>
            <div className="mt-2 flex items-center gap-3">
              {selectedAccount.fb_user_image ? (
                <Image src={selectedAccount.fb_user_image} alt={selectedAccount.fb_user_name || 'Account'} width={32} height={32} className="rounded-full border" />
              ) : (
                <div className="h-8 w-8 rounded-full border bg-muted/40" />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{selectedAccount.fb_user_name || 'Unnamed account'}</p>
                <p className="truncate text-xs text-muted-foreground">{selectedAccount.fb_user_id}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              {selectedPage.picture ? (
                <Image src={selectedPage.picture} alt={selectedPage.name} width={32} height={32} className="rounded border" unoptimized />
              ) : (
                <div className="h-8 w-8 rounded border bg-muted/40" />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{selectedPage.name}</p>
                <p className="truncate text-xs text-muted-foreground">ID: {selectedPage.id}</p>
                {typeof selectedPage.followers_count === 'number' && (
                  <p className="text-xs text-muted-foreground">Followers: {selectedPage.followers_count.toLocaleString()}</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            No page selected yet. Click <span className="font-medium">Select Facebook Page</span>.
          </p>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-medium">From date</span>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} disabled={runInProgress} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium">To date</span>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} disabled={runInProgress} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium">Content type</span>
            <select
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={deleteType}
              onChange={(e) => setDeleteType(e.target.value as ContentType)}
              disabled={runInProgress}
            >
              <option value="posts">Posts</option>
              <option value="photos">Photos</option>
              <option value="reels">Reels</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium">Sort</span>
            <select
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={deleteSort}
              onChange={(e) => setDeleteSort(e.target.value as SortType)}
              disabled={runInProgress}
            >
              <option value="oldest_first">Oldest first</option>
              <option value="newest_first">Newest first</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => void runBulkDelete(ALL_CONTENT_TYPES)} disabled={!selectedPage || !selectedAccountId || runInProgress}>
            <Trash2 className="mr-2 h-4 w-4" />
            {runInProgress ? 'Running...' : 'Delete All Types'}
          </Button>
          <Button onClick={() => void runBulkDelete([deleteType])} disabled={!selectedPage || !selectedAccountId || runInProgress}>
            <Trash2 className="mr-2 h-4 w-4" />
            {runInProgress ? 'Bulk Delete Running...' : 'Run Bulk Delete'}
          </Button>
        </div>

        {runProgress && (
          <div className="rounded-lg border p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Delete progress</p>
              <Badge variant="outline">{progressPercent}%</Badge>
            </div>
            <div className="h-2 overflow-hidden rounded bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="mt-2 grid gap-1 text-xs text-muted-foreground md:grid-cols-2">
              <p className="md:col-span-2 font-medium text-foreground/80">{runProgress.status}</p>
              <p>Processed: {runProgress.processed}/{runProgress.total}</p>
              <p>Succeeded: {runProgress.succeeded}</p>
              <p>Failed: {runProgress.failed}</p>
              <p>Batch: {runProgress.currentBatch}/{runProgress.totalBatches}</p>
              <p>Elapsed: {formatDuration(runProgress.elapsedSeconds)}</p>
              <p>ETA: {formatDuration(runProgress.etaSeconds)}</p>
            </div>
            {runProgress.waitingSeconds > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">Waiting {runProgress.waitingSeconds}s before next batch.</p>
            )}

            <div className="mt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFailureDetails((prev) => !prev)}
                disabled={runFailures.length === 0}
              >
                {showFailureDetails ? 'Hide failed items' : `Show failed items (${runFailures.length})`}
              </Button>
            </div>
            {showFailureDetails && runFailures.length > 0 && (
              <div className="mt-2 max-h-48 space-y-2 overflow-auto rounded border p-2">
                {runFailures.map((item) => (
                  <div key={`${item.id}-${item.error}`} className="rounded border border-destructive/20 bg-destructive/5 p-2">
                    <p className="break-all text-xs font-mono">{item.id}</p>
                    <p className="mt-1 text-xs text-destructive">{item.error}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {selectedPage && (
        <section className="space-y-4 rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Live Content Browser</h3>
              <p className="text-xs text-muted-foreground">Preview current page content from Facebook Graph API.</p>
            </div>
          </div>

          <Tabs value={browseType} onValueChange={(value) => {
            setBrowseType(value as ContentType)
            setBrowseSelectedIds([])
            setBrowseAfterCursor(null)
          }}>
            <TabsList>
              <TabsTrigger value="posts">Posts</TabsTrigger>
              <TabsTrigger value="photos">Photos</TabsTrigger>
              <TabsTrigger value="reels">Reels</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-md border border-dashed p-2">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={browseItems.length > 0 && browseSelectedIds.length === browseItems.length}
                  onChange={(e) => {
                    if (e.target.checked) setBrowseSelectedIds(browseItems.map((item) => item.id))
                    else setBrowseSelectedIds([])
                  }}
                />
                Select all loaded items
              </label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void runDeleteFromBrowserSelection()}
                disabled={!browseSelectedIds.length || runInProgress}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete selected ({browseSelectedIds.length})
              </Button>
            </div>
            {browseItems.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-lg border p-3">
                <input
                  type="checkbox"
                  checked={browseSelectedIds.includes(item.id)}
                  onChange={(e) => {
                    if (e.target.checked) setBrowseSelectedIds((prev) => Array.from(new Set([...prev, item.id])))
                    else setBrowseSelectedIds((prev) => prev.filter((id) => id !== item.id))
                  }}
                />
                {item.preview_image_url ? (
                  <div className="relative h-12 w-12 overflow-hidden rounded-md border">
                    <Image src={item.preview_image_url} alt={item.title} fill className="object-cover" unoptimized />
                  </div>
                ) : (
                  <div className="h-12 w-12 rounded-md border bg-muted/50" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.created_time || 'Unknown date'}</p>
                </div>
                {item.permalink_url && (
                  <a className="text-xs text-primary hover:underline" href={item.permalink_url} target="_blank" rel="noreferrer">
                    Open
                  </a>
                )}
              </div>
            ))}
            {!browseItems.length && !loading && (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No content found for this tab.
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <Button variant="outline" disabled={!browseAfterCursor || loading} onClick={() => void loadBrowseContent(browseType, false)}>
              Load more
            </Button>
          </div>
        </section>
      )}

      <Dialog open={selectModalOpen} onOpenChange={setSelectModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Select Facebook page</DialogTitle>
            <DialogDescription>Choose a connected account first, then select a page.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Step 1: Account</p>
                <Badge variant="outline">{accounts.length} accounts</Badge>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search account" value={accountSearch} onChange={(e) => setAccountSearch(e.target.value)} />
              </div>
              <div className="max-h-64 space-y-2 overflow-auto pr-1">
                {filteredAccounts.map((account) => (
                  <button
                    key={account.id}
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm ${
                      draftAccountId === account.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/30'
                    }`}
                    onClick={() => void onDraftAccountChange(account.id)}
                    type="button"
                  >
                    {account.fb_user_image ? (
                      <Image src={account.fb_user_image} alt={account.fb_user_name || 'Account'} width={28} height={28} className="rounded-full border" />
                    ) : (
                      <div className="h-7 w-7 rounded-full border bg-muted/40" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{account.fb_user_name || 'Unnamed account'}</p>
                      <p className="truncate text-xs text-muted-foreground">{account.fb_user_id}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Step 2: Page</p>
                <Badge variant="outline">{pages.length} pages</Badge>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search page"
                  value={pageSearch}
                  onChange={(e) => setPageSearch(e.target.value)}
                  disabled={!draftAccountId}
                />
              </div>
              <div className="max-h-64 space-y-2 overflow-auto pr-1">
                {filteredPages.map((page) => (
                  <button
                    key={page.id}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                      draftPageId === page.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/30'
                    }`}
                    onClick={() => setDraftPageId(page.id)}
                    type="button"
                  >
                    <p className="font-semibold">{page.name}</p>
                    <p className="text-xs text-muted-foreground">{page.id}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectModalOpen(false)}>Cancel</Button>
            <Button onClick={applyPageSelection} disabled={!draftAccountId || !draftPageId}>Use this page</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

