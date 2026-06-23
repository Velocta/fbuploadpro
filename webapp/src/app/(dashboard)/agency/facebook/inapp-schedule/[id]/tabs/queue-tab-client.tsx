'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CalendarClock,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Video,
  Type,
  Ban,
  GripVertical,
  Pencil,
  Lock,
  MessageSquare,
  List,
  Calendar,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isToday,
  addMonths,
  subMonths,
  isSameMonth,
} from 'date-fns'
import { toast } from 'sonner'
import Image from 'next/image'
import { cn } from '@/lib/utils'

type InappPost = {
  id: string
  media_type: 'text' | 'image' | 'video'
  caption: string | null
  first_comment: string | null
  scheduled_at: string
  status: 'pending' | 'failed' | 'published'
  media_url?: string | null
  bulk_batch_id?: string | null
}

const EDIT_LOCK_MS = 5 * 60 * 1000 // 5 minutes

function EditPostDialog({
  post,
  isOpen,
  onClose,
  onSuccess,
}: {
  post: InappPost
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [caption, setCaption] = useState(post.caption || '')
  const [firstComment, setFirstComment] = useState(post.first_comment || '')
  const [isPending, setIsPending] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsPending(true)
    try {
      const res = await fetch(`/api/v1/agency/facebook/inapp-schedule/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption, firstComment }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to update post')
      }
      toast.success('Post updated successfully')
      onSuccess()
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update post'
      toast.error(msg)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[550px] overflow-hidden rounded-3xl border border-border/50 bg-card/95 p-0 shadow-2xl backdrop-blur-xl">
        <DialogHeader className="border-b border-border/50 bg-muted/10 px-6 py-5">
          <DialogTitle className="font-display text-xl">Queue Post Details</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            Preview media and edit posting details
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* Media Preview Section */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Media Preview</Label>
            {post.media_type === 'video' && post.media_url ? (
              <div className="relative w-full rounded-xl overflow-hidden bg-black ring-1 ring-border/50 flex items-center justify-center" style={{ aspectRatio: '16/10', maxHeight: '240px' }}>
                <video
                  src={post.media_url}
                  controls
                  className="w-full h-full object-contain"
                  style={{ maxHeight: '240px' }}
                  preload="metadata"
                />
              </div>
            ) : post.media_type === 'image' && post.media_url ? (
              <div className="relative w-full rounded-xl overflow-hidden bg-muted ring-1 ring-border/50 flex items-center justify-center" style={{ aspectRatio: '16/10', maxHeight: '240px' }}>
                <img
                  src={post.media_url}
                  alt="Post preview"
                  className="w-full h-full object-contain"
                  style={{ maxHeight: '240px' }}
                />
              </div>
            ) : (
              <div className="w-full rounded-xl border border-border/50 bg-muted/30 p-5 min-h-[100px] flex flex-col items-center justify-center text-center">
                <Type className="h-6 w-6 text-primary/40 mb-2" />
                <span className="text-xs text-muted-foreground font-medium">Text-only Post</span>
              </div>
            )}
          </div>

          {/* Caption Input */}
          <div className="space-y-2">
            <Label htmlFor="caption" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Caption</Label>
            <Textarea
              id="caption"
              placeholder="Write a caption..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="h-28 rounded-xl border-border/50 bg-background/50 focus-visible:ring-primary/20"
            />
          </div>

          {/* First Comment Input */}
          <div className="space-y-2">
            <Label htmlFor="firstComment" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">First Comment (Optional)</Label>
            <Textarea
              id="firstComment"
              placeholder="Write first comment..."
              value={firstComment}
              onChange={(e) => setFirstComment(e.target.value)}
              className="h-20 rounded-xl border-border/50 bg-background/50 focus-visible:ring-primary/20"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={isPending} className="px-6 rounded-xl">
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function QueueTabClient({ pageId }: { pageId: string }) {
  const searchParams = useSearchParams()
  const bulkBatchFromUrl = searchParams.get('bulkBatch')

  const [posts, setPosts] = useState<InappPost[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  const [editingPost, setEditingPost] = useState<InappPost | null>(null)

  // View mode & calendar month state
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(new Date())
  
  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const [page, setPage] = useState(1)
  const [bulkBatchFilter, setBulkBatchFilter] = useState<string | null>(bulkBatchFromUrl)
  const limit = 50 // Increased to 50 for easier drag and drop reordering of queues

  useEffect(() => {
    if (bulkBatchFromUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBulkBatchFilter(bulkBatchFromUrl)
    }
  }, [bulkBatchFromUrl])

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        pageId,
        limit: String(viewMode === 'calendar' ? 200 : limit),
        offset: String(viewMode === 'calendar' ? 0 : (page - 1) * limit),
        status: 'pending',
      })
      if (bulkBatchFilter) params.set('bulkBatchId', bulkBatchFilter)
      const res = await fetch(`/api/v1/agency/facebook/inapp-schedule?${params.toString()}`)
      const data = await res.json()
      if (res.ok) {
        setPosts(data.posts)
        setTotalCount(data.totalCount)
      }
    } catch {
      toast.error('Failed to load queue')
    } finally {
      setLoading(false)
    }
  }, [pageId, page, bulkBatchFilter, viewMode])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchPosts()
  }, [fetchPosts])

  const handleCancel = async (postId: string) => {
    setCancelingId(postId)
    try {
      const res = await fetch(`/api/v1/agency/facebook/inapp-schedule/${postId}/cancel`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to cancel')
      toast.success('Post cancelled')
      void fetchPosts()
    } catch {
      toast.error('Could not cancel post')
    } finally {
      setCancelingId(null)
    }
  }

  // Check if a post is within the 5 minute edit-lock
  const isPostLocked = useCallback((scheduledAt: string) => {
    const msUntil = new Date(scheduledAt).getTime() - Date.now()
    return msUntil < EDIT_LOCK_MS
  }, [])

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOverIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === targetIndex) return

    const itemToMove = posts[draggedIndex]
    const targetItem = posts[targetIndex]

    if (!itemToMove || !targetItem) return

    if (isPostLocked(itemToMove.scheduled_at) || isPostLocked(targetItem.scheduled_at)) {
      toast.warning('Cannot reorder posts enqueued for immediate publishing')
      return
    }

    const reordered = [...posts]
    const [removed] = reordered.splice(draggedIndex, 1)
    if (!removed) return
    reordered.splice(targetIndex, 0, removed)

    // Optimistic state update
    setPosts(reordered)

    try {
      const res = await fetch('/api/v1/agency/facebook/inapp-schedule/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId,
          orderedPostIds: reordered.map((p) => p.id),
        }),
      })

      if (!res.ok) throw new Error()
      toast.success('Queue order updated')
      void fetchPosts() // Refetch to align scheduled times calculated by server
    } catch {
      toast.error('Failed to save queue order')
      void fetchPosts() // Rollback
    }
  }

  const totalPages = Math.ceil(totalCount / limit) || 1

  // Calendar View calculations
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const monthStart = startOfMonth(currentMonthDate)
  const monthEnd = endOfMonth(monthStart)
  const gridStart = startOfWeek(monthStart)
  const gridEnd = endOfWeek(monthEnd)
  const calendarDays = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const postsByDay = posts.reduce((acc, post) => {
    try {
      const dateStr = format(parseISO(post.scheduled_at), 'yyyy-MM-dd')
      if (!acc[dateStr]) {
        acc[dateStr] = []
      }
      acc[dateStr].push(post)
    } catch (e) {
      console.error('Failed to parse date:', post.scheduled_at, e)
    }
    return acc
  }, {} as Record<string, InappPost[]>)

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/50 bg-card/40 p-4 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="text-sm font-semibold text-foreground">
            Pending Posts Queue
          </div>
          <div className="flex items-center gap-1 border border-border/50 bg-muted/30 p-1 rounded-xl">
            <Button
              type="button"
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="h-7 px-2.5 text-xs font-medium rounded-lg flex items-center gap-1.5"
            >
              <List className="h-3.5 w-3.5" />
              List
            </Button>
            <Button
              type="button"
              variant={viewMode === 'calendar' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('calendar')}
              className="h-7 px-2.5 text-xs font-medium rounded-lg flex items-center gap-1.5"
            >
              <Calendar className="h-3.5 w-3.5" />
              Calendar
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {bulkBatchFilter && (
            <>
              <Badge variant="secondary" className="gap-1 text-xs">
                Bulk batch
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  setBulkBatchFilter(null)
                  setPage(1)
                  window.history.replaceState(null, '', `/agency/facebook/inapp-schedule/${pageId}`)
                }}
              >
                Clear batch filter
              </Button>
            </>
          )}
          <span className="text-sm text-muted-foreground">
            Showing {posts.length} of {totalCount} posts
          </span>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <div className="space-y-4">
          {/* Calendar Month Navigation Header */}
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/50 bg-card/40 p-4 shadow-xl backdrop-blur-xl">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              {format(currentMonthDate, 'MMMM yyyy')}
            </h3>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={() => setCurrentMonthDate(subMonths(currentMonthDate, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg text-xs"
                onClick={() => setCurrentMonthDate(new Date())}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={() => setCurrentMonthDate(addMonths(currentMonthDate, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Calendar Month Grid */}
          <div className="rounded-2xl border border-border/50 bg-card/25 p-4 shadow-xl backdrop-blur-xl">
            {/* Days of Week Header */}
            <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-semibold text-muted-foreground">
              {weekDays.map((day) => (
                <div key={day} className="py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd')
                const dayPosts = postsByDay[dateStr] || []
                const isCurrentMonth = isSameMonth(day, currentMonthDate)
                const isTodayDate = isToday(day)

                return (
                  <div
                    key={dateStr}
                    className={cn(
                      "min-h-[140px] flex flex-col rounded-xl border p-2 transition-all duration-200",
                      isCurrentMonth 
                        ? "border-border/50 bg-card/30" 
                        : "border-border/20 bg-card/10 opacity-40",
                      isTodayDate && "border-primary/60 bg-primary/5 ring-1 ring-primary/20",
                      "hover:border-primary/30"
                    )}
                  >
                    {/* Day Number Header */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={cn(
                          "text-xs font-bold px-1.5 py-0.5 rounded-md",
                          isTodayDate 
                            ? "bg-primary text-primary-foreground" 
                            : "text-muted-foreground"
                        )}
                      >
                        {format(day, 'd')}
                      </span>
                      {dayPosts.length > 0 && (
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                          {dayPosts.length}
                        </span>
                      )}
                    </div>

                    {/* Day Posts List */}
                    <div className="flex-1 overflow-y-auto space-y-1.5 max-h-[105px] pr-0.5 scrollbar-thin">
                      {dayPosts.map((post) => {
                        const isLocked = isPostLocked(post.scheduled_at)
                        return (
                          <div
                            key={post.id}
                            onClick={() => !isLocked && setEditingPost(post)}
                            className={cn(
                              "group relative flex items-start gap-1 p-1.5 rounded-lg border text-[10px] leading-tight transition-all duration-150 select-none",
                              isLocked 
                                ? "border-border/30 bg-muted/20 opacity-70 cursor-not-allowed" 
                                : "border-border/50 bg-background/50 hover:border-primary/50 hover:bg-background/80 cursor-pointer"
                            )}
                            title={post.caption || "No caption"}
                          >
                            <div className="shrink-0 text-muted-foreground/60 mt-0.5">
                              {post.media_type === 'video' ? (
                                <Video className="h-3 w-3" />
                              ) : post.media_type === 'image' ? (
                                <ImageIcon className="h-3 w-3" />
                              ) : (
                                <Type className="h-3 w-3" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-foreground/80">
                                {format(parseISO(post.scheduled_at), 'h:mm a')}
                              </div>
                              <div className="truncate text-muted-foreground font-medium">
                                {post.caption || "No caption"}
                              </div>
                            </div>
                            {isLocked && (
                              <div className="absolute right-1 top-1 text-muted-foreground/30">
                                <Lock className="h-2.5 w-2.5" />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="relative min-h-[300px]">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 py-20 text-center">
              <CalendarClock className="h-10 w-10 text-muted-foreground/50" />
              <h3 className="mt-4 font-semibold">Queue is empty</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                You don&apos;t have any pending posts scheduled.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {posts.map((post, index) => {
                  const isLocked = isPostLocked(post.scheduled_at)
                  return (
                    <motion.div
                      key={post.id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      draggable={!isLocked}
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      onDrop={(e) => handleDrop(e, index)}
                      onClick={(e) => {
                        const target = e.target as HTMLElement
                        if (isLocked || target.closest('button') || target.closest('.cursor-grab')) return
                        setEditingPost(post)
                      }}
                      className={cn(
                        'group flex flex-col md:flex-row items-start md:items-center gap-4 rounded-xl border border-border/50 bg-card/40 p-4 transition-all duration-200',
                        draggedIndex === index && 'opacity-30 border-primary bg-primary/5',
                        dragOverIndex === index && 'border-primary bg-primary/5 scale-[1.005]',
                        isLocked ? 'border-border/30 cursor-not-allowed' : 'hover:border-primary/40 hover:bg-card/60 cursor-pointer'
                      )}
                    >
                      {/* Drag Handle & Position Indicator */}
                      <div className="flex items-center gap-2 self-stretch md:self-auto justify-between md:justify-start">
                        {!isLocked ? (
                          <div className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground p-1 rounded transition-colors">
                            <GripVertical className="h-4 w-4" />
                          </div>
                        ) : (
                          <div className="text-muted-foreground/20 p-1" title="Locked: Publishing soon">
                            <Lock className="h-3.5 w-3.5" />
                          </div>
                        )}
                        <span className="font-mono text-xs font-semibold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
                          #{index + 1}
                        </span>
                      </div>

                      {/* Thumbnail Preview */}
                      <div className="relative h-14 w-14 shrink-0 rounded-lg bg-muted/30 border border-border/40 overflow-hidden flex items-center justify-center">
                        {post.media_url ? (
                          <Image
                            src={post.media_url}
                            alt="Media Preview"
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="text-muted-foreground/30">
                            {post.media_type === 'video' ? (
                              <Video className="h-5 w-5" />
                            ) : post.media_type === 'image' ? (
                              <ImageIcon className="h-5 w-5" />
                            ) : (
                              <Type className="h-5 w-5" />
                            )}
                          </div>
                        )}
                      </div>

                      {/* Post Content Details */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0">
                            {post.media_type}
                          </Badge>
                          {post.bulk_batch_id && (
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-primary/5 text-primary border-primary/10">
                              Bulk
                            </Badge>
                          )}
                          {isLocked && (
                            <Badge variant="destructive" className="text-[9px] px-1.5 py-0 gap-1">
                              <Lock className="h-2 w-2" /> Publishing Soon
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-foreground font-medium truncate max-w-[500px]">
                          {post.caption || <span className="italic text-muted-foreground/60">No caption</span>}
                        </p>
                        {post.first_comment && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground truncate max-w-[450px]">
                            <MessageSquare className="h-3 w-3 shrink-0" />
                            <span className="truncate">First comment: {post.first_comment}</span>
                          </div>
                        )}
                      </div>

                      {/* Timing & Scheduling info */}
                      <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center self-stretch md:self-auto gap-4 md:gap-1 text-xs text-muted-foreground pt-2 md:pt-0 border-t md:border-t-0 border-border/20">
                        <div className="flex items-center gap-1.5 font-semibold text-foreground bg-primary/5 text-primary px-2.5 py-1 rounded-lg border border-primary/10">
                          <CalendarClock className="h-3.5 w-3.5" />
                          {format(parseISO(post.scheduled_at), 'MMM d, h:mm a')}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingPost(post)}
                          disabled={isLocked}
                          className="h-8 rounded-lg text-xs"
                        >
                          <Pencil className="h-3 w-3 mr-1" /> Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancel(post.id)}
                          disabled={cancelingId === post.id}
                          className="h-8 rounded-lg text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20 hover:border-destructive/30"
                        >
                          {cancelingId === post.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Ban className="h-3 w-3 mr-1" />
                          )}
                          Cancel
                        </Button>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {viewMode === 'list' && totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || loading}
          >
            Next <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}

      {editingPost && (
        <EditPostDialog
          post={editingPost}
          isOpen={true}
          onClose={() => setEditingPost(null)}
          onSuccess={fetchPosts}
        />
      )}
    </div>
  )
}
