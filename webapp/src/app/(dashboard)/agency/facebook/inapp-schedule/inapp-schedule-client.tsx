'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TimezoneSelect } from '@/components/dashboard/timezone-select'
import { toast } from 'sonner'
import { uploadViaPresign } from '@/features/facebook/shared/media-upload'
import { fromZonedTime } from 'date-fns-tz'

type SavedPage = { id: string; fb_page_name: string | null; fb_page_id: string }

export function InappScheduleClient() {
  const [savedPages, setSavedPages] = useState<SavedPage[]>([])
  const [posts, setPosts] = useState<Array<Record<string, unknown>>>([])
  const [savedPageId, setSavedPageId] = useState('')
  const [mediaType, setMediaType] = useState<'text' | 'image' | 'video'>('text')
  const [caption, setCaption] = useState('')
  const [firstComment, setFirstComment] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [timezone, setTimezone] = useState('UTC')
  const [localDate, setLocalDate] = useState('')
  const [localTime, setLocalTime] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const refresh = async () => {
    const [pagesRes, postsRes] = await Promise.all([
      fetch('/api/v1/agency/facebook/inapp-schedule/pages'),
      fetch('/api/v1/agency/facebook/inapp-schedule'),
    ])
    if (pagesRes.ok) setSavedPages((await pagesRes.json()).pages || [])
    if (postsRes.ok) setPosts((await postsRes.json()).posts || [])
  }

  useEffect(() => {
    void refresh()
  }, [])

  const queuePost = async () => {
    if (!savedPageId || !localDate || !localTime) {
      toast.error('Select page and schedule time')
      return
    }
    if (mediaType !== 'text' && !file) {
      toast.error('Upload media for image or video')
      return
    }

    setSubmitting(true)
    try {
      const scheduledAt = fromZonedTime(`${localDate}T${localTime}:00`, timezone).toISOString()
      let mediaObjectKey: string | undefined
      if (file) {
        mediaObjectKey = await uploadViaPresign({ file, feature: 'inapp-schedule' })
      }

      const res = await fetch('/api/v1/agency/facebook/inapp-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          savedPageId,
          mediaType,
          caption,
          firstComment: firstComment || undefined,
          mediaObjectKey,
          scheduledAt,
          timezone,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Queue failed')
      }

      toast.success('Queued for publishing')
      await refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Queue failed')
    } finally {
      setSubmitting(false)
    }
  }

  const cancelPost = async (id: string) => {
    const res = await fetch(`/api/v1/agency/facebook/inapp-schedule/${id}/cancel`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Cancel failed')
      return
    }
    await refresh()
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between">
        <p className="text-sm text-muted-foreground">Posts publish from our queue at the scheduled time.</p>
        <Button variant="outline" asChild>
          <Link href="/agency/facebook/inapp-schedule/pages">Manage pages</Link>
        </Button>
      </div>

      <section className="grid gap-6 rounded-2xl border border-border p-6 lg:grid-cols-2">
        <div className="space-y-4">
          <h2 className="font-semibold">Queue post</h2>
          <Select value={savedPageId} onValueChange={setSavedPageId}>
            <SelectTrigger><SelectValue placeholder="Saved page" /></SelectTrigger>
            <SelectContent>
              {savedPages.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.fb_page_name || p.fb_page_id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={mediaType} onValueChange={(v) => setMediaType(v as 'text' | 'image' | 'video')}>
            <SelectTrigger><SelectValue placeholder="Post type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="image">Image</SelectItem>
              <SelectItem value="video">Video</SelectItem>
            </SelectContent>
          </Select>
          <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption" rows={3} />
          <Input value={firstComment} onChange={(e) => setFirstComment(e.target.value)} placeholder="First comment (optional)" />
          <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <TimezoneSelect value={timezone} onValueChange={setTimezone} />
          <div className="grid grid-cols-2 gap-3">
            <Input type="date" value={localDate} onChange={(e) => setLocalDate(e.target.value)} />
            <Input type="time" value={localTime} onChange={(e) => setLocalTime(e.target.value)} />
          </div>
          <Button onClick={queuePost} disabled={submitting}>{submitting ? 'Queuing…' : 'Queue'}</Button>
        </div>

        <div className="space-y-3">
          <h2 className="font-semibold">Queue</h2>
          {posts.map((post) => (
            <div key={String(post.id)} className="rounded-lg border border-border p-3 text-sm">
              <p className="font-medium">{String((post as { facebook_inapp_schedule_pages?: { fb_page_name?: string } }).facebook_inapp_schedule_pages?.fb_page_name || post.fb_page_id)}</p>
              <p className="text-muted-foreground">{String(post.status)} · {new Date(String(post.scheduled_at)).toLocaleString()}</p>
              {post.error_message ? <p className="text-destructive">{String(post.error_message)}</p> : null}
              {post.status === 'pending' ? (
                <Button size="sm" variant="outline" className="mt-2" onClick={() => cancelPost(String(post.id))}>
                  Cancel
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
