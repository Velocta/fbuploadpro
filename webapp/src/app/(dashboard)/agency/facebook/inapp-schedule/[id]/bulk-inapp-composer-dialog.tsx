'use client'

import { useCallback, useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  CalendarClock,
  CalendarPlus,
  Image as ImageIcon,
  Loader2,
  Plus,
  Trash2,
  Type,
  UploadCloud,
  Video,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { uploadViaPresign } from '@/features/facebook/shared/media-upload'
import { BULK_SCHEDULE_MAX_ITEMS } from '@/lib/direct-schedule-bulk'

type QueueItem = {
  id: string
  mediaType: 'text' | 'image' | 'video'
  caption: string
  firstComment?: string
  fileName?: string
  previewUrl?: string
  mediaObjectKey?: string
  uploadProgress: number
  uploading: boolean
}

function newId() {
  return crypto.randomUUID()
}

function detectMediaType(file: File): 'image' | 'video' {
  return file.type.startsWith('video/') ? 'video' : 'image'
}

interface BulkInappComposerDialogProps {
  pageId: string
  children: React.ReactNode
}

export function BulkInappComposerDialog({ pageId, children }: BulkInappComposerDialogProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [submitProgress, setSubmitProgress] = useState(0)

  const [items, setItems] = useState<QueueItem[]>([])
  const [globalFirstComment, setGlobalFirstComment] = useState('')

  const resetState = useCallback(() => {
    setItems((prev) => {
      prev.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
      })
      return []
    })
    setSubmitProgress(0)
    setGlobalFirstComment('')
  }, [])

  const uploadItem = async (itemId: string, file: File) => {
    const mediaType = detectMediaType(file)
    setItems((prev) =>
      prev.map((row) =>
        row.id === itemId ? { ...row, uploading: true, uploadProgress: 0, mediaType } : row
      )
    )
    try {
      const objectKey = await uploadViaPresign({
        file,
        feature: 'inapp-schedule',
        onProgress: (pct) => {
          setItems((prev) =>
            prev.map((row) => (row.id === itemId ? { ...row, uploadProgress: pct } : row))
          )
        },
      })
      setItems((prev) =>
        prev.map((row) =>
          row.id === itemId
            ? { ...row, mediaObjectKey: objectKey, uploading: false, uploadProgress: 100 }
            : row
        )
      )
    } catch {
      toast.error('Upload failed', { description: file.name })
      setItems((prev) => prev.filter((row) => row.id !== itemId))
    }
  }

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return
    const remaining = BULK_SCHEDULE_MAX_ITEMS - items.length
    if (remaining <= 0) {
      toast.error(`Maximum ${BULK_SCHEDULE_MAX_ITEMS} items per batch`)
      return
    }

    const toAdd = Array.from(files).slice(0, remaining)
    const newRows: QueueItem[] = toAdd.map((file) => {
      const id = newId()
      const mediaType = detectMediaType(file)
      const previewUrl = URL.createObjectURL(file)
      return {
        id,
        mediaType,
        caption: '',
        fileName: file.name,
        previewUrl,
        uploadProgress: 0,
        uploading: true,
      }
    })

    setItems((prev) => [...prev, ...newRows])
    toAdd.forEach((file, index) => {
      void uploadItem(newRows[index]!.id, file)
    })
  }

  const addTextRow = () => {
    if (items.length >= BULK_SCHEDULE_MAX_ITEMS) {
      toast.error(`Maximum ${BULK_SCHEDULE_MAX_ITEMS} items per batch`)
      return
    }
    setItems((prev) => [
      ...prev,
      {
        id: newId(),
        mediaType: 'text',
        caption: '',
        uploadProgress: 100,
        uploading: false,
      },
    ])
  }

  const removeItem = (id: string) => {
    setItems((prev) => {
      const row = prev.find((r) => r.id === id)
      if (row?.previewUrl) URL.revokeObjectURL(row.previewUrl)
      return prev.filter((r) => r.id !== id)
    })
  }

  const updateCaption = (id: string, caption: string) => {
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, caption } : r)))
  }

  const updateFirstComment = (id: string, firstComment: string) => {
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, firstComment } : r)))
  }

  const isFormValid = items.length > 0 && items.every((row) => {
    if (row.uploading) return false
    if (row.mediaType !== 'text' && !row.mediaObjectKey) return false
    if (row.mediaType === 'text' && !row.caption.trim()) return false
    return true
  })

  const handleSubmit = () => {
    if (!isFormValid) return

    startTransition(async () => {
      setSubmitProgress(0)
      try {
        const res = await fetch('/api/v1/agency/facebook/inapp-schedule/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            savedPageId: pageId,
            items: items.map((row) => ({
              mediaType: row.mediaType,
              caption: row.caption || undefined,
              mediaObjectKey: row.mediaObjectKey,
              firstComment: row.firstComment?.trim() || globalFirstComment.trim() || undefined,
            })),
          }),
        })

        const result = await res.json()
        setSubmitProgress(100)

        if (!res.ok && !result.summary) {
          toast.error('Bulk queue failed', { description: result.error || 'Unknown error' })
          return
        }

        const { summary, batchId } = result
        if (summary?.queued > 0) {
          toast.success(`Queued ${summary.queued} post${summary.queued === 1 ? '' : 's'} for publishing`)
        } else {
          toast.error('No posts were queued', { description: result.error })
          return
        }

        setOpen(false)
        resetState()
        router.refresh()
        if (batchId) {
          router.push(`/agency/facebook/inapp-schedule/${pageId}?bulkBatch=${batchId}`)
        }
      } catch {
        toast.error('Bulk queue failed due to a network error')
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        const anyUploading = items.some((r) => r.uploading)
        if (!val && (anyUploading || isPending)) {
          toast.warning('Please wait for uploads or queueing to finish')
          return
        }
        setOpen(val)
        if (!val) resetState()
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden border-0 bg-transparent p-0 shadow-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex max-h-[90vh] flex-col overflow-hidden rounded-3xl border border-border/50 bg-card/95 shadow-2xl backdrop-blur-xl"
        >
          <DialogHeader className="shrink-0 border-b border-border/50 bg-muted/10 px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                  <CalendarClock className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <DialogTitle className="font-display text-xl">Bulk Queue Posts</DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Add posts to the bottom of the sequential queue
                  </p>
                </div>
              </div>
              <Badge variant="outline">{items.length} / {BULK_SCHEDULE_MAX_ITEMS}</Badge>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-6">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()}>
                <UploadCloud className="h-4 w-4" />
                Add media files
              </Button>
              <Button type="button" variant="outline" className="gap-2" onClick={addTextRow}>
                <Plus className="h-4 w-4" />
                Add text post
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => {
                  handleFiles(e.target.files)
                  e.target.value = ''
                }}
              />
            </div>

            {items.length === 0 ? (
              <div
                className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/50 bg-background/30 py-20"
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadCloud className="h-10 w-10 text-muted-foreground/40" />
                <p className="mt-4 text-sm font-semibold">Drop or select images and videos</p>
                <p className="mt-1 text-xs text-muted-foreground">Up to {BULK_SCHEDULE_MAX_ITEMS} posts per batch</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-3">
                  {items.map((row) => {
                    const Icon = row.mediaType === 'text' ? Type : row.mediaType === 'video' ? Video : ImageIcon
                    return (
                      <div
                        key={row.id}
                        className="flex flex-col gap-3 rounded-xl border border-border/50 bg-background/40 p-4 transition-all duration-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted border border-border/40">
                            {row.previewUrl && row.mediaType === 'image' ? (
                              <Image src={row.previewUrl} alt="" width={56} height={56} className="h-full w-full object-cover" unoptimized />
                            ) : (
                              <Icon className="h-6 w-6 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] uppercase font-mono">{row.mediaType}</Badge>
                              {row.fileName && (
                                <span className="truncate text-xs text-muted-foreground max-w-[200px]">{row.fileName}</span>
                              )}
                              {row.uploading && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                                  <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                  {Math.round(row.uploadProgress)}%
                                </span>
                              )}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(row.id)}
                            disabled={row.uploading || isPending}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground">Caption</Label>
                            <Textarea
                              placeholder={row.mediaType === 'text' ? 'Post text (required)' : 'Caption (optional)'}
                              value={row.caption}
                              onChange={(e) => updateCaption(row.id, e.target.value)}
                              className="min-h-[70px] resize-none text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-semibold text-muted-foreground">First Comment (optional)</Label>
                            <Textarea
                              placeholder="Add first comment for this post..."
                              value={row.firstComment || ''}
                              onChange={(e) => updateFirstComment(row.id, e.target.value)}
                              className="min-h-[70px] resize-none text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="rounded-2xl border border-border/50 bg-muted/20 p-4 space-y-3">
                  <Label htmlFor="globalFirstComment" className="text-xs font-semibold">
                    Global First Comment (applied if post-specific comment is blank)
                  </Label>
                  <Textarea
                    id="globalFirstComment"
                    placeholder="Enter comment text..."
                    value={globalFirstComment}
                    onChange={(e) => setGlobalFirstComment(e.target.value)}
                    className="min-h-[72px] resize-none text-sm bg-background/50"
                  />
                </div>
              </div>
            )}

            {isPending && (
              <div className="space-y-2">
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all duration-300 animate-pulse"
                    style={{ width: `${submitProgress}%` }}
                  />
                </div>
                <p className="text-center text-xs text-muted-foreground">Queueing posts…</p>
              </div>
            )}
          </div>

          <div className="flex shrink-0 justify-end gap-3 border-t border-border/50 px-6 py-4 bg-muted/10">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!isFormValid || isPending || items.some((r) => r.uploading)}
              loading={isPending}
              onClick={handleSubmit}
              className="gap-2"
            >
              <CalendarPlus className="h-4 w-4" />
              Queue {items.length} Posts
            </Button>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
