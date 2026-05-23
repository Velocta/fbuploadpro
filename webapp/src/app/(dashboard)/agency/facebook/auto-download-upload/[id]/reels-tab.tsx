'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { AgencyEmptyState, AgencySectionCard } from '@/components/dashboard/agency'
import { AlertCircle, ExternalLink, Film, Loader2, SkipForward, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AduReelRow } from '@/server/services/facebook/adu-reels-service'

type Props = {
  pageId: string
}

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
  const [view, setView] = useState<'queue' | 'history'>('queue')
  const [reels, setReels] = useState<AduReelRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draftCaption, setDraftCaption] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/v1/agency/facebook/auto-download-upload/${pageId}/reels?view=${view}`
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load reels')
      setReels(json.reels || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reels')
      setReels([])
    } finally {
      setLoading(false)
    }
  }, [pageId, view])

  useEffect(() => {
    load()
  }, [load])

  async function saveCaption(reelId: number) {
    setBusyId(reelId)
    try {
      const res = await fetch(
        `/api/v1/agency/facebook/auto-download-upload/${pageId}/reels/${reelId}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ caption: draftCaption }),
        }
      )
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || 'Update failed')
      }
      setEditingId(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  async function runAction(reelId: number, action: 'skip' | 'delete') {
    setBusyId(reelId)
    try {
      const res = await fetch(
        `/api/v1/agency/facebook/auto-download-upload/${pageId}/reels/${reelId}`,
        {
          method: action === 'delete' ? 'DELETE' : 'POST',
          headers: action === 'skip' ? { 'content-type': 'application/json' } : undefined,
          body: action === 'skip' ? JSON.stringify({ action: 'skip' }) : undefined,
        }
      )
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || 'Action failed')
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  function fbPostUrl(graphPostId: string | null) {
    if (!graphPostId) return null
    return `https://www.facebook.com/${graphPostId}`
  }

  return (
    <div className="space-y-4">
      <div className="relative group">
        <div
          className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 to-blue-500/20 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100"
          aria-hidden
        />
        <div className="relative rounded-2xl border border-border/50 bg-card/40 p-2 shadow-2xl backdrop-blur-xl">
          <div className="flex w-full gap-1 rounded-xl border border-border/50 bg-muted/50 p-1">
            {(['queue', 'history'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  'flex flex-1 items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium capitalize transition-all',
                  view === v
                    ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                    : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive" className="rounded-2xl border-destructive/20 bg-destructive/10">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
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
          title={view === 'queue' ? 'No downloaded reels' : 'No posted reels yet'}
          description={
            view === 'queue'
              ? 'The buffer downloader will fill this queue when reels are ready.'
              : 'Posted reels will appear here with links to Facebook.'
          }
        />
      ) : (
        <div className="space-y-4">
          {reels.map((reel) => (
            <AgencySectionCard
              key={reel.id}
              className="space-y-3 rounded-2xl border-border/50 bg-card/40 p-4 shadow-2xl backdrop-blur-xl"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {reel.platform}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">{reel.reel_id}</span>
                </div>
                {view === 'history' && reel.graph_post_id ? (
                  <a
                    href={fbPostUrl(reel.graph_post_id) ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
                  >
                    View on Facebook
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </div>

              {view === 'queue' && reel.media_url ? (
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
                    className="rounded-xl border-border/50 bg-background/50 text-sm"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="rounded-xl"
                      disabled={busyId === reel.id}
                      onClick={() => saveCaption(reel.id)}
                    >
                      Save caption
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-sm text-foreground">
                  {reel.reel_caption || '…'}
                </p>
              )}

              {view === 'queue' ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    disabled={busyId === reel.id}
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
                    disabled={busyId === reel.id}
                    onClick={() => runAction(reel.id, 'skip')}
                  >
                    <SkipForward className="mr-1 h-3.5 w-3.5" />
                    Skip
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="rounded-xl"
                    disabled={busyId === reel.id}
                    onClick={() => runAction(reel.id, 'delete')}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              ) : null}

              {reel.downloaded_at ? (
                <p className="text-xs text-muted-foreground">
                  Downloaded {new Date(reel.downloaded_at).toLocaleString()}
                </p>
              ) : null}
            </AgencySectionCard>
          ))}
        </div>
      )}
    </div>
  )
}
