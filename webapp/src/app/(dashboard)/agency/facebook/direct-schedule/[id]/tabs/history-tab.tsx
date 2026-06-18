'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CalendarClock,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Image as ImageIcon,
  Video,
  Type,
  Ban,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { format, parseISO } from 'date-fns'
import { AgencyInlineStatus } from '@/components/dashboard/agency'
import { toast } from 'sonner'
import Image from 'next/image'

type PostHistory = {
  id: string
  media_type: 'text' | 'image' | 'video'
  caption: string | null
  scheduled_publish_time: string
  status: 'scheduled' | 'published' | 'failed' | 'cancelled'
  error_message: string | null
  graph_post_id: string | null
  media_url?: string | null
  bulk_batch_id?: string | null
}

export function HistoryTab({ pageId }: { pageId: string }) {
  const searchParams = useSearchParams()
  const bulkBatchFromUrl = searchParams.get('bulkBatch')

  const [posts, setPosts] = useState<PostHistory[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [bulkBatchFilter, setBulkBatchFilter] = useState<string | null>(bulkBatchFromUrl)
  const limit = 10

  useEffect(() => {
    if (bulkBatchFromUrl) {
      const t = setTimeout(() => {
        setBulkBatchFilter(bulkBatchFromUrl)
      }, 0)
      return () => clearTimeout(t)
    }
  }, [bulkBatchFromUrl])

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        pageId,
        limit: String(limit),
        offset: String((page - 1) * limit),
      })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (bulkBatchFilter) params.set('bulkBatchId', bulkBatchFilter)
      const res = await fetch(`/api/v1/agency/facebook/direct-schedule?${params.toString()}`)
      const data = await res.json()
      if (res.ok) {
        setPosts(data.posts)
        setTotalCount(data.totalCount)
      }
    } catch {
      toast.error('Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, pageId, bulkBatchFilter])

  useEffect(() => {
    const t = setTimeout(() => {
      void fetchPosts()
    }, 0)
    return () => clearTimeout(t)
  }, [fetchPosts])

  const handleCancel = async (postId: string) => {
    setCancelingId(postId)
    try {
      const res = await fetch(`/api/v1/agency/facebook/direct-schedule/${postId}/cancel`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to cancel')
      toast.success('Post cancelled')
      fetchPosts()
    } catch {
      toast.error('Could not cancel post')
    } finally {
      setCancelingId(null)
    }
  }

  const totalPages = Math.ceil(totalCount / limit) || 1

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/50 bg-card/40 p-4 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="h-9 rounded-lg border border-border/50 bg-background/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
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
                  window.history.replaceState(null, '', `/agency/facebook/direct-schedule/${pageId}`)
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

      {/* Grid */}
      <div className="relative min-h-[300px]">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 py-20 text-center">
            <CalendarClock className="h-10 w-10 text-muted-foreground/50" />
            <h3 className="mt-4 font-semibold">No posts found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {statusFilter !== 'all' ? `No ${statusFilter} posts match your filter.` : 'You haven\'t scheduled any posts yet.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {posts.map((post, i) => (
                <motion.div
                  key={post.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: i * 0.05 }}
                  className="group relative flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card/50 shadow-lg backdrop-blur-sm transition-all hover:border-primary/50 hover:shadow-xl"
                >
                  <div className="aspect-square w-full relative bg-muted/20 overflow-hidden flex flex-col items-center justify-center">
                    {post.media_url ? (
                      <Image 
                        src={post.media_url} 
                        alt="Media Preview" 
                        fill 
                        className="object-cover transition-transform duration-500 group-hover:scale-110" 
                        unoptimized 
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        {post.media_type === 'text' ? <Type size={32} className="opacity-20"/> : post.media_type === 'image' ? <ImageIcon size={32} className="opacity-20"/> : <Video size={32} className="opacity-20"/>}
                      </div>
                    )}
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10 opacity-80" />
                    
                    <div className="absolute top-3 left-3 right-3 flex justify-between items-start z-10">
                      <div className="bg-background/80 text-foreground backdrop-blur-md px-2 py-1 rounded-md text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                        {post.media_type === 'video' ? <Video size={12} /> : post.media_type === 'image' ? <ImageIcon size={12} /> : <Type size={12} />}
                        {post.media_type}
                      </div>
                      
                      <div className="flex flex-col items-end gap-1">
                        {post.bulk_batch_id && (
                          <Badge variant="outline" className="bg-background/80 text-[10px] backdrop-blur-md">
                            Bulk
                          </Badge>
                        )}
                        <AgencyInlineStatus
                          label={post.status}
                          tone={
                            post.status === 'failed' ? 'destructive' : 
                            post.status === 'scheduled' ? 'default' : 'muted'
                          }
                        />
                      </div>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
                      <p className="text-sm font-medium text-white line-clamp-3 leading-tight drop-shadow-md mb-2">
                        {post.caption || <span className="italic opacity-50">No caption</span>}
                      </p>
                      
                      {post.status === 'failed' && post.error_message && (
                        <div className="mb-2 rounded flex items-start gap-1.5 bg-destructive/80 p-2 text-xs text-white backdrop-blur-sm">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <p className="line-clamp-2">{post.error_message}</p>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 text-xs text-white/80">
                        <CalendarClock size={12} />
                        {format(parseISO(post.scheduled_publish_time), 'MMM d, yyyy h:mm a')}
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-muted/30 p-3 flex justify-end gap-2 border-t border-border/50">
                    {post.status === 'scheduled' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancel(post.id)}
                        disabled={cancelingId === post.id}
                        className="h-8 w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        {cancelingId === post.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                        ) : (
                          <Ban className="mr-2 h-3.5 w-3.5" />
                        )}
                        {cancelingId === post.id ? 'Cancelling...' : 'Cancel Post'}
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => setPage(p => Math.max(1, p - 1))}
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
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || loading}
          >
            Next <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
