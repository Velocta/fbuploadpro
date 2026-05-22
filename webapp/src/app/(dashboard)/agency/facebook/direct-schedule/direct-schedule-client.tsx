'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TimezoneSelect } from '@/components/dashboard/timezone-select'
import { toast } from 'sonner'
import { uploadViaPresign } from '@/features/facebook/shared/media-upload'
import { fromZonedTime } from 'date-fns-tz'

type SavedPage = { id: string; fb_page_name: string | null; fb_page_id: string }

export function DirectScheduleClient() {
  const [savedPages, setSavedPages] = useState<SavedPage[]>([])
  const [posts, setPosts] = useState<Array<Record<string, unknown>>>([])
  const [savedPageId, setSavedPageId] = useState('')
  const [mediaType, setMediaType] = useState<'text' | 'image' | 'video'>('text')
  const [caption, setCaption] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [timezone, setTimezone] = useState('UTC')
  const [localDate, setLocalDate] = useState('')
  const [localTime, setLocalTime] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const refresh = async () => {
    const [pagesRes, postsRes] = await Promise.all([
      fetch('/api/v1/agency/facebook/direct-schedule/pages'),
      fetch('/api/v1/agency/facebook/direct-schedule'),
    ])
    if (pagesRes.ok) {
      const d = await pagesRes.json()
      setSavedPages(d.pages || [])
    }
    if (postsRes.ok) {
      const d = await postsRes.json()
      setPosts(d.posts || [])
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const schedule = async () => {
    if (!savedPageId || !localDate || !localTime) {
      toast.error('Select a saved page and schedule time')
      return
    }
    if (mediaType !== 'text' && !file) {
      toast.error('Upload media for image or video posts')
      return
    }

    setSubmitting(true)
    try {
      const localIso = `${localDate}T${localTime}:00`
      const scheduledAt = fromZonedTime(localIso, timezone).toISOString()

      let mediaObjectKey: string | undefined
      if (file) {
        mediaObjectKey = await uploadViaPresign({ file, feature: 'direct-schedule' })
      }

      const res = await fetch('/api/v1/agency/facebook/direct-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          savedPageId,
          mediaType,
          caption,
          mediaObjectKey,
          scheduledAt,
          timezone,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Schedule failed')
      }

      toast.success('Scheduled on Facebook')
      await refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Schedule failed')
    } finally {
      setSubmitting(false)
    }
  }

  const cancelPost = async (id: string) => {
    const res = await fetch(`/api/v1/agency/facebook/direct-schedule/${id}/cancel`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Cancel failed')
      return
    }
    toast.success('Cancelled')
    await refresh()
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Posts are scheduled natively on Facebook.</p>
        <Button variant="outline" asChild>
          <Link href="/agency/facebook/direct-schedule/pages">Manage pages</Link>
        </Button>
      </div>

      <section className="grid gap-6 rounded-2xl border border-border p-6 lg:grid-cols-2">
        <div className="space-y-4">
          <h2 className="font-semibold">New scheduled post</h2>
          <div className="space-y-2">
            <Label>Saved page</Label>
            <Select value={savedPageId} onValueChange={setSavedPageId}>
              <SelectTrigger><SelectValue placeholder="Select saved page" /></SelectTrigger>
              <SelectContent>
                {savedPages.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.fb_page_name || p.fb_page_id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Post type</Label>
            <Select value={mediaType} onValueChange={(v) => setMediaType(v as 'text' | 'image' | 'video')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="video">Video</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Caption</Label>
            <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Media</Label>
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <div className="space-y-2">
            <Label>Timezone</Label>
            <TimezoneSelect value={timezone} onValueChange={setTimezone} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={localDate} onChange={(e) => setLocalDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Time</Label>
              <Input type="time" value={localTime} onChange={(e) => setLocalTime(e.target.value)} />
            </div>
          </div>
          <Button onClick={schedule} disabled={submitting}>{submitting ? 'Scheduling…' : 'Schedule'}</Button>
        </div>

        <div className="space-y-3">
          <h2 className="font-semibold">Scheduled posts</h2>
          {posts.map((post) => (
            <div key={String(post.id)} className="rounded-lg border border-border p-3 text-sm">
              <p className="font-medium">{String((post as { facebook_direct_schedule_pages?: { fb_page_name?: string } }).facebook_direct_schedule_pages?.fb_page_name || post.fb_page_id)}</p>
              <p className="text-muted-foreground">{String(post.status)} · {new Date(String(post.scheduled_publish_time)).toLocaleString()}</p>
              {post.status === 'scheduled' ? (
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
