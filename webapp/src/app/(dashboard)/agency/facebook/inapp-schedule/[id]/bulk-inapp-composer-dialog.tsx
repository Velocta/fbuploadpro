'use client'

import { useCallback, useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  CalendarClock,
  CalendarPlus,
  Copy,
  Image as ImageIcon,
  Loader2,
  Plus,
  Sparkles,
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
import { cn } from '@/lib/utils'

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

function captionFromFileName(fileName: string) {
  const withoutExtension = fileName.replace(/\.[^/.]+$/, '')
  return withoutExtension
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
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
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [globalCaption, setGlobalCaption] = useState('')
  const [globalFirstComment, setGlobalFirstComment] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  const resetState = useCallback(() => {
    setItems((prev) => {
      prev.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
      })
      return []
    })
    setSubmitProgress(0)
    setGlobalCaption('')
    setGlobalFirstComment('')
    setSelectedItemId(null)
    setIsDragging(false)
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
        caption: captionFromFileName(file.name),
        fileName: file.name,
        previewUrl,
        uploadProgress: 0,
        uploading: true,
      }
    })

    setItems((prev) => {
      const updated = [...prev, ...newRows]
      if (updated.length > 0 && !selectedItemId) {
        setSelectedItemId(newRows[0]!.id)
      }
      return updated
    })

    toAdd.forEach((file, index) => {
      void uploadItem(newRows[index]!.id, file)
    })
  }

  const addTextRow = () => {
    if (items.length >= BULK_SCHEDULE_MAX_ITEMS) {
      toast.error(`Maximum ${BULK_SCHEDULE_MAX_ITEMS} items per batch`)
      return
    }
    const newIdVal = newId()
    setItems((prev) => [
      ...prev,
      {
        id: newIdVal,
        mediaType: 'text',
        caption: '',
        uploadProgress: 100,
        uploading: false,
      },
    ])
    setSelectedItemId(newIdVal)
  }

  const removeItem = (id: string) => {
    setItems((prev) => {
      const remaining = prev.filter((r) => r.id !== id)
      if (selectedItemId === id) {
        setSelectedItemId(remaining.length > 0 ? remaining[0]!.id : null)
      }
      const row = prev.find((r) => r.id === id)
      if (row?.previewUrl) URL.revokeObjectURL(row.previewUrl)
      return remaining
    })
  }

  const updateCaption = (id: string, caption: string) => {
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, caption } : r)))
  }

  const updateFirstComment = (id: string, firstComment: string) => {
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, firstComment } : r)))
  }

  const applyGlobalCaptionToAll = () => {
    const caption = globalCaption.trim()
    if (!caption) {
      toast.error('Add a caption to apply first')
      return
    }
    setItems((prev) => prev.map((row) => ({ ...row, caption })))
    toast.success(`Applied caption to ${items.length} post${items.length === 1 ? '' : 's'}`)
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true)
    } else if (e.type === 'dragleave') {
      setIsDragging(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
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

  const activeItem = items.find((r) => r.id === selectedItemId) || items[0]

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
      <DialogContent className="max-h-[95vh] h-[90vh] w-[95vw] sm:max-w-[95vw] md:max-w-[90vw] lg:max-w-[1024px] xl:max-w-[1200px] overflow-hidden border-0 bg-transparent p-0 shadow-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex h-full w-full flex-col overflow-hidden rounded-3xl border border-border/50 bg-card/95 shadow-2xl backdrop-blur-xl"
        >
          {/* Header */}
          <DialogHeader className="shrink-0 border-b border-border/50 bg-muted/10 px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                  <CalendarClock className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <DialogTitle className="font-display text-xl">Bulk Queue Posts</DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Upload media, auto-fill captions from filenames, then edit or apply captions in bulk
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs font-mono font-semibold px-2.5 py-1">
                {items.length} / {BULK_SCHEDULE_MAX_ITEMS} Posts
              </Badge>
            </div>
          </DialogHeader>

          {/* Main Workspace */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {items.length === 0 ? (
              /* Premium Drop Zone Empty State */
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center m-6 rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer',
                  isDragging
                    ? 'border-primary bg-primary/5 scale-[0.995]'
                    : 'border-border/50 bg-background/30 hover:border-primary/50 hover:bg-muted/30'
                )}
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted border border-border/40 shadow-sm mb-4">
                  <UploadCloud className={cn("h-8 w-8 transition-transform duration-300", isDragging ? "scale-110 text-primary" : "text-muted-foreground/60")} />
                </div>
                <p className="text-sm font-semibold">Drag & drop files here, or click to browse</p>
                <p className="mt-1 text-xs text-muted-foreground">Images & videos (Up to {BULK_SCHEDULE_MAX_ITEMS} per batch)</p>
                <div className="flex items-center gap-3 mt-6">
                  <Button type="button" variant="outline" size="sm" className="rounded-lg">
                    Select Files
                  </Button>
                  <span className="text-xs text-muted-foreground font-mono">OR</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-lg gap-1.5"
                    onClick={(e) => {
                      e.stopPropagation()
                      addTextRow()
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Start with Text Post
                  </Button>
                </div>
              </div>
            ) : (
              /* Redesigned Split Pane Layout */
              <div className="flex flex-1 min-h-0 overflow-hidden relative">
                {/* Left Sidebar Pane */}
                <div className={cn(
                  "w-full md:w-[320px] lg:w-[360px] border-border/50 flex flex-col min-h-0 bg-muted/5 shrink-0 transition-all",
                  selectedItemId ? "hidden md:flex md:border-r" : "flex"
                )}>
                  {/* Action buttons */}
                  <div className="p-4 border-b border-border/40 flex items-center justify-between gap-2 bg-muted/20 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 rounded-xl text-xs gap-1.5 h-9"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <UploadCloud className="h-3.5 w-3.5" />
                      Add Media
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 rounded-xl text-xs gap-1.5 h-9"
                      onClick={addTextRow}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Text Post
                    </Button>
                  </div>

                  {/* Scrollable Post Cards List */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar">
                    <div className="rounded-xl border border-primary/15 bg-primary/5 p-3">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
                        <Sparkles className="h-3.5 w-3.5" />
                        Filename captions enabled
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                        New media captions are prefilled from filenames. Edit captions directly below or apply one caption to all posts.
                      </p>
                    </div>
                    {items.map((row) => {
                      const Icon = row.mediaType === 'text' ? Type : row.mediaType === 'video' ? Video : ImageIcon
                      const isActive = selectedItemId === row.id
                      return (
                        <div
                          key={row.id}
                          onClick={() => setSelectedItemId(row.id)}
                          className={cn(
                            'flex w-full gap-3 rounded-xl border p-3 text-left transition-all relative overflow-hidden group',
                            isActive
                              ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                              : 'border-border/50 bg-background/20 hover:border-primary/30 hover:bg-muted/30'
                          )}
                        >
                          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted border border-border/40">
                            {row.previewUrl && row.mediaType === 'image' ? (
                              <Image src={row.previewUrl} alt="" width={44} height={44} className="h-full w-full object-cover" unoptimized />
                            ) : (
                              <Icon className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className="text-[9px] px-1 py-0 uppercase font-mono tracking-wide scale-90 origin-left">{row.mediaType}</Badge>
                              {row.uploading && (
                                <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-semibold">
                                  <Loader2 className="h-2.5 w-2.5 animate-spin text-primary" />
                                  {Math.round(row.uploadProgress)}%
                                </span>
                              )}
                              {row.fileName && (
                                <span className="truncate text-[10px] text-muted-foreground">
                                  {row.fileName}
                                </span>
                              )}
                            </div>
                            <Textarea
                              aria-label={`Caption for ${row.fileName || row.mediaType}`}
                              placeholder={row.mediaType === 'text' ? 'Post text (required)' : 'Caption (optional)'}
                              value={row.caption}
                              onClick={(e) => e.stopPropagation()}
                              onFocus={() => setSelectedItemId(row.id)}
                              onChange={(e) => updateCaption(row.id, e.target.value)}
                              className="min-h-[58px] resize-none rounded-lg border-border/50 bg-background/70 text-xs focus-visible:ring-primary/20"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeItem(row.id)
                            }}
                            disabled={row.uploading || isPending}
                            className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-opacity rounded-lg"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>

                  {/* Bulk caption + global first comment (Sticky at bottom of sidebar) */}
                  <div className="p-4 border-t border-border/50 bg-muted/20 shrink-0 space-y-4">
                    <div>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <Label htmlFor="globalCaption" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          One Caption For All
                        </Label>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={applyGlobalCaptionToAll}
                          disabled={items.length === 0 || !globalCaption.trim() || isPending}
                          className="h-7 gap-1.5 rounded-lg px-2 text-[11px]"
                        >
                          <Copy className="h-3 w-3" />
                          Apply all
                        </Button>
                      </div>
                      <Textarea
                        id="globalCaption"
                        placeholder="Paste one caption here, then apply it to every post..."
                        value={globalCaption}
                        onChange={(e) => setGlobalCaption(e.target.value)}
                        className="min-h-[68px] max-h-[96px] resize-none text-xs rounded-xl border-border/50 bg-background/50 focus-visible:ring-primary/20"
                      />
                    </div>

                    <div>
                      <Label htmlFor="globalFirstComment" className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                        Global First Comment
                      </Label>
                      <Textarea
                        id="globalFirstComment"
                        placeholder="Comment text applied to posts with empty comments..."
                        value={globalFirstComment}
                        onChange={(e) => setGlobalFirstComment(e.target.value)}
                        className="min-h-[60px] max-h-[80px] resize-none text-xs rounded-xl border-border/50 bg-background/50 focus-visible:ring-primary/20"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Workspace Composer Pane */}
                <div className={cn(
                  "flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar bg-background/30 transition-all",
                  !selectedItemId ? "hidden md:block" : "block"
                )}>
                  {activeItem ? (
                    <div className="space-y-5">
                      {/* Mobile Back Button */}
                      <div className="md:hidden flex items-center mb-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedItemId(null)}
                          className="pl-0 gap-1 text-primary hover:text-primary/80"
                        >
                          <span className="text-base">←</span> Back to List
                        </Button>
                      </div>
                      {/* Media Preview Section */}
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Media Preview</Label>
                        {activeItem.mediaType === 'video' && activeItem.previewUrl ? (
                          <div className="relative w-full rounded-2xl overflow-hidden bg-black ring-1 ring-border/50 flex items-center justify-center aspect-[16/10] max-h-[260px]">
                            <video
                              src={activeItem.previewUrl}
                              controls
                              className="w-full h-full object-contain"
                              style={{ maxHeight: '260px' }}
                              preload="metadata"
                            />
                          </div>
                        ) : activeItem.mediaType === 'image' && activeItem.previewUrl ? (
                          <div className="relative w-full rounded-2xl overflow-hidden bg-muted ring-1 ring-border/50 flex items-center justify-center aspect-[16/10] max-h-[260px]">
                            <Image
                              src={activeItem.previewUrl}
                              alt="Post preview"
                              fill
                              className="w-full h-full object-contain"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <div className="w-full rounded-2xl border border-border/50 bg-muted/20 p-8 min-h-[140px] flex flex-col items-center justify-center text-center">
                            <Type className="h-7 w-7 text-primary/30 mb-2" />
                            <span className="text-xs text-muted-foreground font-semibold">Text-only Post Preview</span>
                          </div>
                        )}
                      </div>

                      {/* Caption Input */}
                      <div className="space-y-2">
                        <Label htmlFor="active-caption" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Caption</Label>
                        <Textarea
                          id="active-caption"
                          placeholder={activeItem.mediaType === 'text' ? 'Post text (required)' : 'Caption (optional)'}
                          value={activeItem.caption}
                          onChange={(e) => updateCaption(activeItem.id, e.target.value)}
                          className="min-h-[120px] rounded-xl border-border/50 bg-background/50 focus-visible:ring-primary/20"
                        />
                      </div>

                      {/* First Comment Input */}
                      <div className="space-y-2">
                        <Label htmlFor="active-comment" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">First Comment (Optional)</Label>
                        <Textarea
                          id="active-comment"
                          placeholder="Write first comment for this post..."
                          value={activeItem.firstComment || ''}
                          onChange={(e) => updateFirstComment(activeItem.id, e.target.value)}
                          className="min-h-[80px] rounded-xl border-border/50 bg-background/50 focus-visible:ring-primary/20"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-muted/10 rounded-2xl border border-dashed border-border/50">
                      <Loader2 className="h-8 w-8 text-muted-foreground/30 animate-spin mb-4" />
                      <h3 className="font-semibold text-base mb-1">No Active Selection</h3>
                      <p className="text-sm text-muted-foreground max-w-xs">Select or add a post from the sidebar to edit its properties.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

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

          {/* Submission Indicator */}
          {isPending && (
            <div className="px-6 py-2 bg-muted/10 shrink-0 border-t border-border/40 space-y-2">
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-300 animate-pulse"
                  style={{ width: `${submitProgress}%` }}
                />
              </div>
              <p className="text-center text-xs text-muted-foreground">Queueing posts…</p>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex shrink-0 justify-end gap-3 border-t border-border/50 px-6 py-4 bg-muted/10">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!isFormValid || isPending || items.some((r) => r.uploading)}
              loading={isPending}
              onClick={handleSubmit}
              className="gap-2 px-6 rounded-xl"
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
