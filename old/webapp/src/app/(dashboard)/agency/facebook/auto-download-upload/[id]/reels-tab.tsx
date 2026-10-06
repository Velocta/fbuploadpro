'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { AgencyEmptyState } from '@/components/dashboard/agency'
import { 
  AlertCircle, Film, RefreshCw, SkipForward, Trash2, 
  Save, Clock, MessageSquare, Sparkles, Smartphone, Play,
  Volume2, VolumeX
} from 'lucide-react'
import type { AduReelRow } from '@/server/services/facebook/adu-reels-service'
import { motion, AnimatePresence } from 'framer-motion'

type Props = {
  pageId: string
}

type BusyAction = 'save' | 'skip' | 'delete' | null

function ReelCardSkeleton() {
  return (
    <div className="relative aspect-[9/16] rounded-2xl border border-border/50 bg-card/20 p-4 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-muted/10 to-muted/20" />
      <div className="absolute top-3 left-3 flex gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="absolute bottom-4 left-3 right-3 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}

function MobileSimulator({ reel }: { reel: AduReelRow }) {
  const [isPlaying, setIsPlaying] = useState(true)
  const [isMuted, setIsMuted] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)

  const togglePlay = () => {
    if (!videoRef.current) return
    if (isPlaying) {
      videoRef.current.pause()
      setIsPlaying(false)
    } else {
      void videoRef.current.play()
      setIsPlaying(true)
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setIsPlaying(true)
    if (videoRef.current) {
      videoRef.current.load()
      void videoRef.current.play()
    }
  }, [reel])
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <div className="flex flex-col items-center justify-center p-2">
      {/* Outer Phone Container */}
      <div className="relative w-[270px] h-[480px] bg-slate-950 rounded-[40px] p-2.5 shadow-2xl border-4 border-slate-800 ring-1 ring-white/10 overflow-hidden flex flex-col justify-between">
        
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-5 bg-slate-950 rounded-b-xl z-40 flex items-center justify-center gap-1.5 px-3">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-900 border border-slate-800" />
          <div className="w-8 h-0.5 bg-slate-800 rounded-full" />
        </div>

        {/* Screen Content Wrapper */}
        <div className="relative flex-1 w-full h-full bg-black rounded-[28px] overflow-hidden z-30 flex flex-col select-none group">
          {/* Video Player */}
          {reel.media_url ? (
            <video
              ref={videoRef}
              src={reel.media_url}
              className="absolute inset-0 w-full h-full object-cover cursor-pointer"
              loop
              muted={isMuted}
              playsInline
              onClick={togglePlay}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900 text-muted-foreground text-center p-4">
              <Film size={32} className="opacity-40 animate-pulse text-primary" />
              <p className="text-xs">No preview available</p>
            </div>
          )}

          {/* Mute/Unmute Button */}
          {reel.media_url && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsMuted((prev) => !prev)
              }}
              className="absolute top-8 right-3 p-1.5 bg-black/60 hover:bg-black/80 rounded-full border border-white/15 backdrop-blur-md text-white pointer-events-auto z-20 transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <VolumeX className="w-3.5 h-3.5 text-white/90" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-white" />
              )}
            </button>
          )}

          {/* Screen overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/30 pointer-events-none z-10" />

          {/* Top Status Bar Mock */}
          <div className="absolute top-1 inset-x-0 px-4 flex items-center justify-between text-[8px] text-white/80 font-medium tracking-tight z-20 pointer-events-none">
            <span>9:41</span>
            <div className="flex items-center gap-1">
              <div className="w-4 h-2 border border-white/60 rounded-sm p-px flex items-center">
                <div className="h-full w-full bg-white rounded-2xs" />
              </div>
            </div>
          </div>

          {/* Screen HUD Controls/Mock */}
          <div className="absolute bottom-3 inset-x-0 px-3 flex justify-between items-end z-20 text-white pointer-events-none">
            {/* Left: User Handle + Caption */}
            <div className="flex-1 pr-4 space-y-1">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-pink-500 to-amber-500 border border-white/30 flex items-center justify-center text-[8px] font-bold text-white uppercase">
                  {reel.username?.slice(0, 2) || 'AD'}
                </div>
                <span className="text-[10px] font-semibold drop-shadow">
                  @{reel.username || 'adu_publisher'}
                </span>
              </div>
              <p className="text-[9px] leading-relaxed line-clamp-3 text-white/90 drop-shadow">
                {reel.reel_caption || 'No caption description...'}
              </p>
            </div>

            {/* Right: Interaction icons mock */}
            <div className="flex flex-col items-center gap-3 text-white/80">
              <div className="flex flex-col items-center">
                <span className="text-xs">❤️</span>
                <span className="text-[7px] drop-shadow">1.2k</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xs">💬</span>
                <span className="text-[7px] drop-shadow">48</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xs">➡️</span>
                <span className="text-[7px] drop-shadow">Share</span>
              </div>
            </div>
          </div>

          {/* Floating Play Indicator when paused */}
          {!isPlaying && reel.media_url && (
            <div 
              className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer z-30"
              onClick={togglePlay}
            >
              <div className="w-12 h-12 rounded-full bg-white/20 border border-white/40 backdrop-blur-md flex items-center justify-center text-white shadow-lg transition-transform scale-110">
                <Play className="fill-white stroke-none ml-1 w-5 h-5" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function ReelsTab({ pageId }: Props) {
  const [reels, setReels] = useState<AduReelRow[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [selectedReel, setSelectedReel] = useState<AduReelRow | null>(null)
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false)
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
    const t = setTimeout(() => {
      setInitialLoading(true)
      load()
    }, 0)
    return () => {
      clearTimeout(t)
      abortRef.current?.abort()
    }
  }, [load])

  // Sync selected reel state when list loads or changes
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (reels.length > 0) {
      const firstReel = reels[0]
      if (firstReel) {
        if (!selectedReel) {
          setSelectedReel(firstReel)
          setDraftCaption(firstReel.reel_caption || '')
        } else {
          const found = reels.find((r) => r.id === selectedReel.id)
          if (!found) {
            setSelectedReel(firstReel)
            setDraftCaption(firstReel.reel_caption || '')
          } else if (found.reel_caption !== selectedReel.reel_caption) {
            setSelectedReel(found)
          }
        }
      }
    } else {
      setSelectedReel(null)
      setDraftCaption('')
    }
  }, [reels, selectedReel])
  /* eslint-enable react-hooks/set-state-in-effect */

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
      setIsMobilePanelOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
      await load({ refreshing: true })
    } finally {
      setBusyId(null)
      setBusyAction(null)
    }
  }

  const handleSelectReel = (reel: AduReelRow) => {
    setSelectedReel(reel)
    setDraftCaption(reel.reel_caption || '')
    setIsMobilePanelOpen(true)
  }

  const renderCurationForm = (reel: AduReelRow) => {
    const isRowBusy = busyId === reel.id
    const isSaving = isRowBusy && busyAction === 'save'
    const isSkipping = isRowBusy && busyAction === 'skip'
    const isDeleting = isRowBusy && busyAction === 'delete'

    return (
      <div className="space-y-5 bg-card/40 border border-border/50 rounded-2xl p-5 backdrop-blur-xl shadow-inner">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-xl text-primary">
              <MessageSquare size={16} />
            </div>
            <div>
              <h4 className="text-sm font-semibold">Caption Editor</h4>
              <p className="text-[10px] text-muted-foreground">Adjust text and hashtags</p>
            </div>
          </div>
          <Badge variant="outline" className="capitalize border-primary/20 bg-primary/5 text-primary text-[10px]">
            {reel.platform}
          </Badge>
        </div>

        <div className="space-y-2">
          <Textarea
            value={draftCaption}
            onChange={(e) => setDraftCaption(e.target.value)}
            rows={5}
            disabled={isSaving}
            placeholder="Type your caption here..."
            className="rounded-xl border-border/50 bg-background/50 focus:bg-background/80 text-sm resize-none custom-scrollbar transition-all"
          />
          <div className="flex justify-between items-center text-[10px] text-muted-foreground px-1">
            <span>{draftCaption.length} characters</span>
            <span className="font-mono text-[9px]">ID: {reel.reel_id}</span>
          </div>
        </div>

        {/* Quick Tag Helpers */}
        <div className="flex flex-wrap gap-1">
          {['#reels', '#viral', '#trending', '#foryou', '#shorts'].map((tag) => (
            <button
              key={tag}
              type="button"
              disabled={isSaving}
              onClick={() => {
                if (!draftCaption.includes(tag)) {
                  setDraftCaption((prev) => (prev ? `${prev} ${tag}` : tag))
                }
              }}
              className="text-[10px] font-semibold bg-secondary/50 hover:bg-secondary text-secondary-foreground py-1 px-2.5 rounded-lg border border-border/30 transition-colors"
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Actions grid */}
        <div className="grid grid-cols-1 gap-2 pt-2 border-t border-border/40">
          <Button
            size="sm"
            className="rounded-xl bg-foreground text-background hover:bg-foreground/90 font-semibold flex items-center justify-center gap-1.5 shadow-md h-10 w-full"
            loading={isSaving}
            disabled={queueBusy && !isSaving}
            onClick={() => saveCaption(reel.id)}
          >
            {!isSaving && <Save size={14} />}
            {isSaving ? 'Saving...' : 'Save Caption'}
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl border-amber-500/20 text-amber-500 hover:bg-amber-500/10 font-semibold flex items-center justify-center gap-1.5 h-10"
              loading={isSkipping}
              disabled={queueBusy && !isSkipping}
              onClick={() => runAction(reel.id, 'skip')}
            >
              {!isSkipping && <SkipForward size={14} />}
              {isSkipping ? 'Skipping...' : 'Skip'}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="rounded-xl font-semibold flex items-center justify-center gap-1.5 h-10"
              loading={isDeleting}
              disabled={queueBusy && !isDeleting}
              onClick={() => runAction(reel.id, 'delete')}
            >
              {!isDeleting && <Trash2 size={14} />}
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>

        {reel.downloaded_at && (
          <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground/80 mt-1 justify-center">
            <Clock size={10} />
            <span>Downloaded {new Date(reel.downloaded_at).toLocaleString()}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border/40 pb-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Film className="text-primary w-5 h-5" />
            Downloaded Queue
          </h2>
          <p className="text-xs text-muted-foreground">
            View, edit captions, skip or purge reels from the automatic publication queue
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 rounded-xl text-xs"
          loading={refreshing}
          disabled={initialLoading || queueBusy}
          onClick={() => load({ refreshing: true })}
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive" className="rounded-2xl border-destructive/20 bg-destructive/10">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-2 text-xs">
            <span>{error}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2.5 rounded-lg"
              disabled={refreshing || queueBusy}
              onClick={() => load({ refreshing: true })}
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {initialLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <ReelCardSkeleton />
          <ReelCardSkeleton />
          <ReelCardSkeleton />
        </div>
      ) : reels.length === 0 ? (
        <AgencyEmptyState
          icon={<Film className="h-8 w-8" />}
          title="No reels in queue"
          description="The automated buffer downloader has no pending downloads for this page."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
          {/* Left panel: reels grid */}
          <div className="lg:col-span-3 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {reels.map((reel) => {
                const isActive = selectedReel?.id === reel.id
                return (
                  <motion.div
                    key={reel.id}
                    layout
                    onClick={() => handleSelectReel(reel)}
                    className={`group relative aspect-[9/16] rounded-2xl overflow-hidden cursor-pointer border-2 transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 ${
                      isActive
                        ? 'border-primary shadow-lg bg-primary/5'
                        : 'border-border/50 hover:border-primary/40 bg-card/30'
                    }`}
                  >
                    {/* Video Cover */}
                    {reel.media_url ? (
                      <div className="absolute inset-0 z-0 bg-black/40">
                        <video
                          src={reel.media_url}
                          className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity duration-300"
                          preload="metadata"
                          muted
                          playsInline
                        />
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
                        <Film className="h-6 w-6 text-muted-foreground/30" />
                      </div>
                    )}

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/10 z-10" />

                    {/* Top Platform Badge */}
                    <div className="absolute top-2.5 left-2.5 right-2.5 z-20 flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className="bg-black/60 backdrop-blur-md border-none text-white text-[9px] py-px px-2 capitalize gap-1 font-medium shadow-sm"
                      >
                        {reel.platform === 'instagram' && (
                          <span className="w-1 h-1 rounded-full bg-pink-500 animate-pulse" />
                        )}
                        {reel.platform === 'tiktok' && (
                          <span className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />
                        )}
                        {reel.platform === 'facebook' && (
                          <span className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
                        )}
                        {reel.platform}
                      </Badge>
                      {isActive && (
                        <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center text-[10px] text-white font-bold">
                          ✓
                        </div>
                      )}
                    </div>

                    {/* Bottom Details */}
                    <div className="absolute bottom-2.5 left-2.5 right-2.5 z-20 space-y-1">
                      <p className="text-[10px] text-white font-medium line-clamp-2 leading-relaxed drop-shadow-sm">
                        {reel.reel_caption || 'No caption...'}
                      </p>
                      {reel.downloaded_at && (
                        <p className="text-[8px] text-white/50 font-mono">
                          {new Date(reel.downloaded_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>

          {/* Right panel: Curation pane (sticky on desktop) */}
          <div className="lg:col-span-2 sticky top-6 hidden lg:block space-y-6">
            <div className="bg-card/30 border border-border/50 rounded-3xl p-6 shadow-xl space-y-6">
              <div className="flex items-center gap-2 border-b border-border/40 pb-4">
                <Smartphone className="text-primary w-5 h-5 animate-pulse" />
                <div>
                  <h3 className="font-semibold text-sm">Interactive Workspace</h3>
                  <p className="text-[10px] text-muted-foreground">Mobile preview & detailed configuration</p>
                </div>
              </div>

              {selectedReel ? (
                <div className="space-y-6">
                  {/* Smartphone Simulator */}
                  <MobileSimulator reel={selectedReel} />

                  {/* Caption Editor Form */}
                  {renderCurationForm(selectedReel)}
                </div>
              ) : (
                <div className="text-center py-20 bg-muted/10 border border-dashed rounded-2xl flex flex-col items-center justify-center gap-3">
                  <Film className="w-8 h-8 text-muted-foreground/30 animate-bounce" />
                  <p className="text-xs text-muted-foreground font-medium">Select a reel to configure</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Curation Drawer */}
      <AnimatePresence>
        {isMobilePanelOpen && selectedReel && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md lg:hidden flex flex-col justify-end">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-card border-t border-border/50 rounded-t-[32px] w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col pb-8"
            >
              <div className="flex justify-between items-center px-6 py-4 border-b border-border/40 sticky top-0 bg-card/90 backdrop-blur-md z-30">
                <div>
                  <h3 className="font-semibold text-sm flex items-center gap-1.5">
                    <Sparkles className="text-primary w-4 h-4 animate-spin" />
                    Reel Curation
                  </h3>
                  <span className="text-[10px] text-muted-foreground">Preview & Edit Caption</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsMobilePanelOpen(false)}
                  className="rounded-full w-8 h-8 p-0"
                >
                  ✕
                </Button>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="flex justify-center">
                  <MobileSimulator reel={selectedReel} />
                </div>
                {renderCurationForm(selectedReel)}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
