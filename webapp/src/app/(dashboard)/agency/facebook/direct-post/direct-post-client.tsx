'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { uploadViaPresign } from '@/features/facebook/shared/media-upload'

type Account = { id: string; fb_user_name?: string | null }
type FbPage = { id: string; name: string }

export function DirectPostClient() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [pages, setPages] = useState<FbPage[]>([])
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([])
  const [accountId, setAccountId] = useState('')
  const [pageId, setPageId] = useState('')
  const [mediaType, setMediaType] = useState<'text' | 'image' | 'video'>('text')
  const [caption, setCaption] = useState('')
  const [firstComment, setFirstComment] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const loadHistory = async () => {
    const res = await fetch('/api/v1/agency/facebook/direct-post')
    if (res.ok) {
      const data = await res.json()
      setHistory(data.posts || [])
    }
  }

  useEffect(() => {
    void loadHistory()
    void fetch('/api/v1/agency/facebook/accounts')
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts || []))
  }, [])

  useEffect(() => {
    if (!accountId) {
      setPages([])
      setPageId('')
      return
    }
    void fetch(`/api/v1/agency/facebook/accounts/${accountId}/pages`)
      .then((r) => r.json())
      .then((d) => setPages(d.pages || []))
  }, [accountId])

  const onSubmit = async () => {
    if (!accountId || !pageId) {
      toast.error('Select an account and page')
      return
    }
    if (mediaType !== 'text' && !file) {
      toast.error('Upload a file for image or video posts')
      return
    }

    setSubmitting(true)
    try {
      let mediaObjectKey: string | undefined
      if (file) {
        mediaObjectKey = await uploadViaPresign({ file, feature: 'direct-post' })
      }

      const res = await fetch('/api/v1/agency/facebook/direct-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facebookAccountId: accountId,
          fbPageId: pageId,
          mediaType,
          caption,
          firstComment: firstComment || undefined,
          mediaObjectKey,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Publish failed')
      }

      toast.success('Published to Facebook')
      setCaption('')
      setFirstComment('')
      setFile(null)
      await loadHistory()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Publish failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section className="space-y-4 rounded-2xl border border-border p-6">
        <h2 className="text-lg font-semibold">Publish now</h2>

        <div className="space-y-2">
          <Label>Facebook account</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.fb_user_name || a.id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Page</Label>
          <Select value={pageId} onValueChange={setPageId}>
            <SelectTrigger><SelectValue placeholder="Select page" /></SelectTrigger>
            <SelectContent>
              {pages.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
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
          <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={4} />
        </div>

        <div className="space-y-2">
          <Label>First comment (optional)</Label>
          <Input value={firstComment} onChange={(e) => setFirstComment(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>Media file (optional for text)</Label>
          <Input type="file" accept={mediaType === 'image' ? 'image/*' : mediaType === 'video' ? 'video/*' : '*/*'} onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </div>

        <Button onClick={onSubmit} disabled={submitting}>
          {submitting ? 'Publishing…' : 'Publish'}
        </Button>
      </section>

      <section className="space-y-3 rounded-2xl border border-border p-6">
        <h2 className="text-lg font-semibold">Recent posts</h2>
        <ul className="space-y-2 text-sm">
          {history.map((row) => (
            <li key={String(row.id)} className="rounded-lg border border-border p-3">
              <p className="font-medium">{String(row.fb_page_name || row.fb_page_id)}</p>
              <p className="text-muted-foreground">{String(row.media_type)} · {String(row.status)}</p>
              {row.error_message ? <p className="text-destructive">{String(row.error_message)}</p> : null}
            </li>
          ))}
          {history.length === 0 ? <p className="text-muted-foreground">No posts yet.</p> : null}
        </ul>
      </section>
    </div>
  )
}
