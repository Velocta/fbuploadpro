'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { AgencyEmptyState, AgencySectionCard } from '@/components/dashboard/agency'
import { AlertCircle, Film, Loader2, RefreshCw, SkipForward, Trash2 } from 'lucide-react'
import type { AduReelRow } from '@/server/services/facebook/adu-reels-service'

type Props = {
  pageId: string
}

type BusyAction = 'save' | 'skip' | 'delete' | null

function ReelCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/40 p-4 shadow-lg backdrop-blur-xl">
      <div className="mb-3 flex justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-20" />
      </div>
      <Skeleton className="mb-3 h-48 w-full rounded-xl" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-3/4" />
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-9 w-24 rounded-xl" />
        <Skeleton className="h-9 w-20 rounded-xl" />
      </div>
    </div>
  )
}

export function ReelsTab({ pageId }: Props) {
  const [reels, setReels] = useState<AduReelRow[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draftCaption, setDraftCaption] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [busyAction, setBusyAction] = useState<BusyAction>(null)
  const abortRef = useRef<AbortController | null>(null)
  const hasLoadedRef = useRef(false)

  const queueBusy = busyId !== null

  const load = useCallback(
    async (options?: { refreshing?: boolean }) => {
      const isRefresh = options?.refreshing ?? hasLoadedRef.current
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setInitialLoading(true)
      }
      setError(null)

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch(
          `/api/v1/agency/facebook/auto-download-upload/${pageId}/reels?view=queue`,
          { signal: controller.signal },
        )
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to load reels')
        setReels(json.reels || [])
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return
        setError(e instanceof Error ? e.message : 'Failed to load reels')
        if (!isRefresh) setReels([])
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null
        }
        hasLoadedRef.current = true
        setInitialLoading(false)
        setRefreshing(false)
      }
    },
    [pageId],
  )

  useEffect(() => {
    hasLoadedRef.current = false
    setInitialLoading(true)
    load()
    return () => {
      abortRef.current?.abort()
    }
  }, [load])

  async function saveCaption(reelId: number) {
    if (queueBusy) return
    setBusyId(reelId)
    setBusyAction('save')
    try {
      const res = await fetch(
        `/api/v1/agency/facebook/auto-download-upload/${pageId}/reels/${reelId}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ caption: draftCaption }),
        },
      )
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || 'Update failed')
      }
      setReels((prev) =>
        prev.map((r) => (r.id === reelId ? { ...r, reel_caption: draftCaption } : r)),
      )
      setEditingId(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
      await load({ refreshing: true })
    } finally {
      setBusyId(null)
      setBusyAction(null)
    }
  }

  async function runAction(reelId: number, action: 'skip' | 'delete') {
    if (queueBusy) return
    if (action === 'delete') {
      const confirmed = window.confirm('Remove this reel from the queue? This cannot be undone.')
      if (!confirmed) return
    }

    setBusyId(reelId)
    setBusyAction(action === 'skip' ? 'skip' : 'delete')
    try {
      const res = await fetch(
        `/api/v1/agency/facebook/auto-download-upload/${pageId}/reels/${reelId}`,
        {
          method: action === 'delete' ? 'DELETE' : 'POST',
          headers: action === 'skip' ? { 'content-type': 'application/json' } : undefined,
          body: action === 'skip' ? JSON.stringify({ action: 'skip' }) : undefined,
        },
      )
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || 'Action failed')
      }
      setReels((prev) => prev.filter((r) => r.id !== reelId))
      if (editingId === reelId) setEditingId(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
      await load({ refreshing: true })
    } finally {
      setBusyId(null)
      setBusyAction(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Downloaded reels waiting to publish
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 rounded-xl"
          loading={refreshing}
          disabled={initialLoading || queueBusy}
          onClick={() => load({ refreshing: true })}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive" className="rounded-2xl border-destructive/20 bg-destructive/10">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            <span>{error}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7"
              disabled={refreshing || queueBusy}
              onClick={() => load({ refreshing: true })}
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {initialLoading ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Loading reels…
          </div>
          <ReelCardSkeleton />
          <ReelCardSkeleton />
        </div>
      ) : reels.length === 0 ? (
        <AgencyEmptyState
          icon={<Film className="h-6 w-6" />}
          title="No downloaded reels"
          description="The buffer downloader will fill this queue when reels are ready."
        />
      ) : (
        <div className="relative space-y-4">
          {refreshing ? (
            <div className="absolute right-0 top-0 z-10 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Updating…
            </div>
          ) : null}
          {reels.map((reel) => {
            const isRowBusy = busyId === reel.id
            const isSaving = isRowBusy && busyAction === 'save'
            const isSkipping = isRowBusy && busyAction === 'skip'
            const isDeleting = isRowBusy && busyAction === 'delete'

            return (
              <AgencySectionCard
                key={reel.id}
                className="space-y-3 rounded-2xl border-border/50 bg-card/40 p-4 shadow-2xl backdrop-blur-xl"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {reel.platform}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">{reel.reel_id}</span>
                </div>

                {reel.media_url ? (
                  <video
                    src={reel.media_url}
                    controls
                    className="max-h-64 w-full rounded-xl border border-border/50 bg-black"
                    preload="metadata"
                  />
                ) : null}

                {editingId === reel.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={draftCaption}
                      onChange={(e) => setDraftCaption(e.target.value)}
                      rows={4}
                      disabled={isSaving}
                      className="rounded-xl border-border/50 bg-background/50 text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="rounded-xl"
                        loading={isSaving}
                        disabled={queueBusy && !isSaving}
                        onClick={() => saveCaption(reel.id)}
                      >
                        {isSaving ? 'Saving…' : 'Save caption'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl"
                        disabled={isSaving || isSkipping || isDeleting}
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm text-foreground">
                    {reel.reel_caption || '…'}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    disabled={queueBusy}
                    onClick={() => {
                      setEditingId(reel.id)
                      setDraftCaption(reel.reel_caption || '')
                    }}
                  >
                    Edit caption
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="rounded-xl"
                    loading={isSkipping}
                    disabled={queueBusy && !isSkipping}
                    onClick={() => runAction(reel.id, 'skip')}
                  >
                    <SkipForward className="mr-1 h-3.5 w-3.5" />
                    {isSkipping ? 'Skipping…' : 'Skip'}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="rounded-xl"
                    loading={isDeleting}
                    disabled={queueBusy && !isDeleting}
                    onClick={() => runAction(reel.id, 'delete')}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    {isDeleting ? 'Deleting…' : 'Delete'}
                  </Button>
                </div>

                {reel.downloaded_at ? (
                  <p className="text-xs text-muted-foreground">
                    Downloaded {new Date(reel.downloaded_at).toLocaleString()}
                  </p>
                ) : null}
              </AgencySectionCard>
            )
          })}
        </div>
      )}
    </div>
  )
}
