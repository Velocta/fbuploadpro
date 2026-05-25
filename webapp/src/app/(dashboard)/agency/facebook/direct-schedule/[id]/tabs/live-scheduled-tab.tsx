'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CalendarClock,
  Loader2,
  ExternalLink,
  Facebook,
  Ban,
  Clock,
  Type,
  Image as ImageIcon,
  Video
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { toast } from 'sonner'
import Image from 'next/image'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { TimezoneSelect } from '@/components/dashboard/timezone-select'

type GraphAttachment = {
  media?: {
    image?: { src: string }
  }
  type: string
}

type GraphScheduledPost = {
  id: string
  message?: string
  scheduled_publish_time: number
  created_time: string
  attachments?: {
    data: GraphAttachment[]
  }
}

export function LiveScheduledTab({
  fbPageId,
  pageAccessToken,
}: {
  fbPageId: string
  pageAccessToken: string
}) {
  const [posts, setPosts] = useState<GraphScheduledPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancelingId, setCancelingId] = useState<string | null>(null)

  const [reschedulePost, setReschedulePost] = useState<GraphScheduledPost | null>(null)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  )
  const [isRescheduling, setIsRescheduling] = useState(false)

  useEffect(() => {
    fetchScheduledPosts()
  }, [fbPageId, pageAccessToken])

  async function fetchScheduledPosts() {
    if (!fbPageId || !pageAccessToken) {
      setError('Missing page credentials')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(
        `https://graph.facebook.com/v25.0/${fbPageId}/scheduled_posts?fields=message,created_time,scheduled_publish_time,attachments,id&access_token=${pageAccessToken}`
      )
      
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to fetch from Facebook')
      }

      setPosts(data.data || [])
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(msg)
      toast.error('Failed to load live scheduled posts', { description: msg })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (graphId: string) => {
    setCancelingId(graphId)
    try {
      const res = await fetch(`/api/v1/agency/facebook/direct-schedule/graph/${graphId}?pageToken=${pageAccessToken}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('Post deleted from Facebook')
      fetchScheduledPosts()
    } catch (e) {
      toast.error('Could not delete post')
    } finally {
      setCancelingId(null)
    }
  }

  const handleReschedule = async () => {
    if (!reschedulePost || !scheduleDate || !scheduleTime) {
      toast.error('Please select a date and time')
      return
    }
    
    setIsRescheduling(true)
    try {
      const res = await fetch(`/api/v1/agency/facebook/direct-schedule/graph/${reschedulePost.id}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageToken: pageAccessToken,
          scheduledAt: `${scheduleDate}T${scheduleTime}:00`,
          timezone
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to reschedule')
      }

      toast.success('Post rescheduled successfully')
      setReschedulePost(null)
      fetchScheduledPosts()
    } catch (e) {
      toast.error('Failed to reschedule post', { description: e instanceof Error ? e.message : 'Unknown error' })
    } finally {
      setIsRescheduling(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-blue-600 dark:text-blue-400">
        <Facebook className="h-5 w-5 shrink-0" />
        <p>
          These are the actual posts currently waiting in Facebook's native scheduling queue for this page.
        </p>
      </div>

      <div className="relative min-h-[300px]">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/5 py-20 text-center text-destructive">
            <p className="font-semibold">Error loading posts</p>
            <p className="mt-1 text-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchScheduledPosts} className="mt-4">
              Retry
            </Button>
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 py-20 text-center">
            <CalendarClock className="h-10 w-10 text-muted-foreground/50" />
            <h3 className="mt-4 font-semibold">No native scheduled posts</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Facebook does not currently have any scheduled posts queued for this page.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {posts.map((post, i) => {
                const attachment = post.attachments?.data?.[0]
                const imageUrl = attachment?.media?.image?.src
                
                return (
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
                      {imageUrl ? (
                        <Image 
                          src={imageUrl} 
                          alt="Media Preview" 
                          fill 
                          className="object-cover transition-transform duration-500 group-hover:scale-110" 
                          unoptimized 
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <Type size={32} className="opacity-20"/>
                        </div>
                      )}
                      
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10 opacity-80" />
                      
                      <div className="absolute top-3 left-3 right-3 flex justify-between items-start z-10">
                        <div className="bg-background/80 text-foreground backdrop-blur-md px-2 py-1 rounded-md text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                          <Facebook size={12} className="text-blue-500" />
                          Native
                        </div>
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs bg-background/50 backdrop-blur-md border-border/50" asChild>
                          <a href={`https://business.facebook.com/latest/posts/scheduled_posts?asset_id=${fbPageId}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3 mr-1.5" />
                            Meta Suite
                          </a>
                        </Button>
                      </div>

                      <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
                        <p className="text-sm font-medium text-white line-clamp-3 leading-tight drop-shadow-md mb-2">
                          {post.message || <span className="italic opacity-50">No text content</span>}
                        </p>
                        
                        <div className="flex items-center gap-2 text-xs text-white/80">
                          <CalendarClock size={12} />
                          {format(post.scheduled_publish_time * 1000, 'MMM d, yyyy h:mm a')}
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-muted/30 p-3 grid grid-cols-2 gap-2 border-t border-border/50">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setReschedulePost(post)}
                        className="h-8 w-full border-border/50 bg-background/50"
                      >
                        <Clock className="mr-2 h-3.5 w-3.5" />
                        Reschedule
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(post.id)}
                        disabled={cancelingId === post.id}
                        className="h-8 w-full text-destructive hover:bg-destructive/10 hover:text-destructive border-border/50 bg-background/50"
                      >
                        {cancelingId === post.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                        ) : (
                          <Ban className="mr-2 h-3.5 w-3.5" />
                        )}
                        Delete
                      </Button>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      <Dialog open={!!reschedulePost} onOpenChange={(open) => !open && setReschedulePost(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Reschedule Post</DialogTitle>
            <DialogDescription>
              Select a new date and time for this post to be published on Facebook.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Time</Label>
              <Input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Timezone</Label>
              <TimezoneSelect value={timezone} onValueChange={setTimezone} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReschedulePost(null)}>
              Cancel
            </Button>
            <Button onClick={handleReschedule} disabled={isRescheduling}>
              {isRescheduling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
