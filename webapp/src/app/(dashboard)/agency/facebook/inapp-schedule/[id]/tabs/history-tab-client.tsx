'use client'

import { useState, useEffect } from 'react'
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
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { format, parseISO } from 'date-fns'
import { AgencyInlineStatus } from '@/components/dashboard/agency'
import { toast } from 'sonner'
import Image from 'next/image'

type InappPostHistory = {
  id: string
  media_type: 'text' | 'image' | 'video'
  caption: string | null
  scheduled_at: string
  status: 'failed' | 'published' | 'pending'
  error_message: string | null
  media_url?: string | null
}

export function HistoryTabClient({ pageId }: { pageId: string }) {
  const [posts, setPosts] = useState<InappPostHistory[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const limit = 10

  useEffect(() => {
    fetchPosts()
  }, [page, statusFilter, pageId])

  async function fetchPosts() {
    setLoading(true)
    try {
      const res = await fetch(`/api/v1/agency/facebook/inapp-schedule?pageId=${pageId}&limit=${limit}&offset=${(page - 1) * limit}${statusFilter !== 'all' ? `&status=${statusFilter}` : ''}`)
      const data = await res.json()
      if (res.ok) {
        // Exclude pending if 'all' is selected, to act like a true history tab
        const filteredPosts = statusFilter === 'all' 
          ? data.posts.filter((p: any) => p.status !== 'pending')
          : data.posts

        setPosts(filteredPosts)
        setTotalCount(statusFilter === 'all' ? filteredPosts.length : data.totalCount) // Approximation
      }
    } catch (e) {
      toast.error('Failed to load history')
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.ceil(totalCount / limit) || 1

  return (
    <div className="space-y-6">
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
            <option value="all">All History</option>
            <option value="published">Published</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <div className="text-sm text-muted-foreground">
          Showing {posts.length} of {totalCount} posts
        </div>
      </div>

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
              {statusFilter !== 'all' ? `No ${statusFilter} posts match your filter.` : 'No post history available.'}
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
                      
                      <AgencyInlineStatus
                        label={post.status}
                        tone={
                          post.status === 'failed' ? 'destructive' : 
                          post.status === 'published' ? 'default' : 'muted'
                        }
                      />
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
                        {format(parseISO(post.scheduled_at), 'MMM d, yyyy h:mm a')}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

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
