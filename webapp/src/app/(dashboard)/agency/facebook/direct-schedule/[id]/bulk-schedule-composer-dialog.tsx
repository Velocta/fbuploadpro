'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, addDays } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { useRouter } from 'next/navigation'
import {
  CalendarClock,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Loader2,
  Plus,
  Trash2,
  Type,
  UploadCloud,
  Video,
  AlertCircle,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PostsPerDayPicker } from '@/components/dashboard/posts-per-day-picker'
import { TimezoneSelect } from '@/components/dashboard/timezone-select'
import { TimeSlotInput } from '@/components/dashboard/time-slot-input'
import { cn } from '@/lib/utils'
import { uploadViaPresign } from '@/features/facebook/shared/media-upload'
import {
  BULK_SCHEDULE_MAX_ITEMS,
  ensurePostingTimesLength,
  generateBulkScheduleTimestamps,
  type BulkScheduleType,
} from '@/lib/direct-schedule-bulk'

type QueueItem = {
  id: string
  mediaType: 'text' | 'image' | 'video'
  caption: string
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

interface BulkScheduleComposerDialogProps {
  pageId: string
  children: React.ReactNode
}

export function BulkScheduleComposerDialog({ pageId, children }: BulkScheduleComposerDialogProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [isPending, startTransition] = useTransition()
  const [submitProgress, setSubmitProgress] = useState(0)

  const [items, setItems] = useState<QueueItem[]>([])
  const [postsPerDay, setPostsPerDay] = useState(2)
  const [scheduleType, setScheduleType] = useState<BulkScheduleType>('dailyrandom')
  const [postingTimes, setPostingTimes] = useState<string[]>(['09:00 AM', '03:00 PM'])
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [startDate, setStartDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'))
  const [previewError, setPreviewError] = useState<string | null>(null)

  const totalSteps = 3
  const cappedPostsPerDay = Math.min(5, Math.max(1, postsPerDay))

  const resetState = useCallback(() => {
    setItems((prev) => {
      prev.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
      })
      return []
    })
    setStep(1)
    setPostsPerDay(2)
    setScheduleType('dailyrandom')
    setPostingTimes(['09:00 AM', '03:00 PM'])
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone)
    setStartDate(format(addDays(new Date(), 1), 'yyyy-MM-dd'))
    setPreviewError(null)
    setSubmitProgress(0)
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
        feature: 'direct-schedule',
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

  const previewTimestamps = useMemo(() => {
    if (items.length === 0) return []
    try {
      return generateBulkScheduleTimestamps(items.length, {
        startDate,
        postsPerDay: cappedPostsPerDay,
        scheduleType,
        postingTimes: ensurePostingTimesLength(postingTimes, cappedPostsPerDay),
        timezone,
      })
    } catch {
      return []
    }
  }, [items.length, startDate, cappedPostsPerDay, scheduleType, postingTimes, timezone])

  useEffect(() => {
    if (items.length === 0) {
      setPreviewError(null)
      return
    }
    try {
      generateBulkScheduleTimestamps(items.length, {
        startDate,
        postsPerDay: cappedPostsPerDay,
        scheduleType,
        postingTimes: ensurePostingTimesLength(postingTimes, cappedPostsPerDay),
        timezone,
      })
      setPreviewError(null)
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Invalid schedule')
    }
  }, [items.length, startDate, cappedPostsPerDay, scheduleType, postingTimes, timezone])

  const daysSpan = useMemo(() => {
    if (!items.length) return 0
    return Math.ceil(items.length / cappedPostsPerDay)
  }, [items.length, cappedPostsPerDay])

  const contentValid = items.length > 0 && items.every((row) => {
    if (row.uploading) return false
    if (row.mediaType !== 'text' && !row.mediaObjectKey) return false
    if (row.mediaType === 'text' && !row.caption.trim()) return false
    return true
  })

  const scheduleValid =
    !!startDate &&
    (scheduleType === 'dailyrandom' ||
      ensurePostingTimesLength(postingTimes, cappedPostsPerDay).every((t) => String(t || '').trim()))

  const previewValid = contentValid && scheduleValid && previewTimestamps.length === items.length

  const handleSubmit = () => {
    if (!previewValid) return

    startTransition(async () => {
      setSubmitProgress(0)
      try {
        const res = await fetch('/api/v1/agency/facebook/direct-schedule/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            savedPageId: pageId,
            items: items.map((row) => ({
              mediaType: row.mediaType,
              caption: row.caption || undefined,
              mediaObjectKey: row.mediaObjectKey,
            })),
            schedule: {
              startDate,
              postsPerDay: cappedPostsPerDay,
              scheduleType,
              postingTimes:
                scheduleType === 'fixed'
                  ? ensurePostingTimesLength(postingTimes, cappedPostsPerDay)
                  : [],
              timezone,
            },
          }),
        })

        const result = await res.json()
        setSubmitProgress(100)

        if (!res.ok && !result.summary) {
          toast.error('Bulk schedule failed', { description: result.error || 'Unknown error' })
          return
        }

        const { summary, batchId } = result
        if (summary?.scheduled > 0) {
          toast.success(`Scheduled ${summary.scheduled} of ${summary.total} posts`, {
            description: summary.failed > 0 ? `${summary.failed} failed` : undefined,
          })
        } else {
          toast.error('No posts were scheduled', { description: result.error })
          return
        }

        setOpen(false)
        resetState()
        router.refresh()
        if (batchId) {
          router.push(`/agency/facebook/direct-schedule/${pageId}?bulkBatch=${batchId}`)
        }
      } catch {
        toast.error('Bulk schedule failed due to a network error')
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        const anyUploading = items.some((r) => r.uploading)
        if (!val && (anyUploading || isPending)) {
          toast.warning('Please wait for uploads or scheduling to finish')
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
                  <DialogTitle className="font-display text-xl">Bulk Schedule</DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    Step {step} of {totalSteps}
                  </p>
                </div>
              </div>
              <Badge variant="outline">{items.length} / {BULK_SCHEDULE_MAX_ITEMS}</Badge>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {step === 1 && (
              <div className="space-y-4">
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
                    className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/50 bg-background/30 py-16"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <UploadCloud className="h-10 w-10 text-muted-foreground" />
                    <p className="mt-4 text-sm font-medium">Drop or select images and videos</p>
                    <p className="mt-1 text-xs text-muted-foreground">Up to {BULK_SCHEDULE_MAX_ITEMS} posts per batch</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {items.map((row) => {
                      const Icon = row.mediaType === 'text' ? Type : row.mediaType === 'video' ? Video : ImageIcon
                      return (
                        <div
                          key={row.id}
                          className="flex gap-3 rounded-xl border border-border/50 bg-background/40 p-3"
                        >
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                            {row.previewUrl && row.mediaType === 'image' ? (
                              <img src={row.previewUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <Icon className="h-6 w-6 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs capitalize">{row.mediaType}</Badge>
                              {row.fileName && (
                                <span className="truncate text-xs text-muted-foreground">{row.fileName}</span>
                              )}
                              {row.uploading && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  {Math.round(row.uploadProgress)}%
                                </span>
                              )}
                            </div>
                            <Textarea
                              placeholder={row.mediaType === 'text' ? 'Post text (required)' : 'Caption (optional)'}
                              value={row.caption}
                              onChange={(e) => updateCaption(row.id, e.target.value)}
                              className="min-h-[60px] resize-none text-sm"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(row.id)}
                            disabled={row.uploading || isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Start date</Label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="flex h-11 w-full rounded-xl border border-border/50 bg-background/50 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Posting type</Label>
                    <Select
                      value={scheduleType}
                      onValueChange={(v: BulkScheduleType) => {
                        setScheduleType(v)
                        if (v === 'fixed') {
                          setPostingTimes(ensurePostingTimesLength(postingTimes, cappedPostsPerDay))
                        }
                      }}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dailyrandom">Random posting times</SelectItem>
                        <SelectItem value="fixed">Fixed posting times</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <TimezoneSelect value={timezone} onValueChange={setTimezone} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Posts per day (max 5)</Label>
                  <PostsPerDayPicker
                    value={cappedPostsPerDay}
                    onValueChange={(v) => {
                      const n = Math.min(5, Math.max(1, Number.parseInt(v, 10) || 1))
                      setPostsPerDay(n)
                      setPostingTimes((prev) => ensurePostingTimesLength(prev, n))
                    }}
                  />
                </div>

                {scheduleType === 'dailyrandom' && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-primary">
                    <AlertCircle className="mr-1 inline h-3 w-3" />
                    Balanced random times are generated per day with at least a 5-hour gap between slots.
                  </div>
                )}

                {scheduleType === 'fixed' && (
                  <div className="space-y-2">
                    <Label>Fixed posting times</Label>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {ensurePostingTimesLength(postingTimes, cappedPostsPerDay).map((time, index) => (
                        <TimeSlotInput
                          key={`bulk-time-${index}`}
                          idPrefix={`bulk-schedule-time-${index}`}
                          value={time || ''}
                          onChange={(value) => {
                            setPostingTimes((prev) => {
                              const next = [...ensurePostingTimesLength(prev, cappedPostsPerDay)]
                              next[index] = value
                              return next
                            })
                          }}
                          nextFieldId={
                            index < cappedPostsPerDay - 1
                              ? `bulk-schedule-time-${index + 1}-field`
                              : undefined
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                {previewError && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    {previewError}
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  {items.length} posts over approximately {daysSpan} day{daysSpan === 1 ? '' : 's'} at{' '}
                  {cappedPostsPerDay} post{cappedPostsPerDay === 1 ? '' : 's'} per day.
                </p>
                <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                  {items.map((row, index) => {
                    const iso = previewTimestamps[index]
                    const localLabel = iso
                      ? formatInTimeZone(iso, timezone, 'MMM d, yyyy h:mm a zzz')
                      : '—'
                    return (
                      <div
                        key={row.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2 text-sm"
                      >
                        <span className="truncate text-muted-foreground">
                          #{index + 1}{' '}
                          {row.caption.trim().slice(0, 40) || row.fileName || row.mediaType}
                        </span>
                        <span className="shrink-0 font-medium">{localLabel}</span>
                      </div>
                    )
                  })}
                </div>
                {isPending && (
                  <div className="space-y-2">
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${submitProgress}%` }}
                      />
                    </div>
                    <p className="text-center text-xs text-muted-foreground">Scheduling on Facebook…</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex shrink-0 justify-between gap-3 border-t border-border/50 px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              disabled={step === 1 || isPending}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              {step < totalSteps ? (
                <Button
                  type="button"
                  disabled={
                    (step === 1 && !contentValid) ||
                    (step === 2 && !scheduleValid) ||
                    items.some((r) => r.uploading)
                  }
                  onClick={() => setStep((s) => Math.min(totalSteps, s + 1))}
                >
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={!previewValid || isPending}
                  loading={isPending}
                  onClick={handleSubmit}
                  className="gap-2"
                >
                  <CalendarPlus className="h-4 w-4" />
                  Schedule {items.length} posts
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
