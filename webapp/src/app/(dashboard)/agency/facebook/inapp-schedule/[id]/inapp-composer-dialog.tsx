'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  CalendarPlus,
  Type,
  Image as ImageIcon,
  Video,
  UploadCloud,
  FileCheck,
  CheckCircle2,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { uploadViaPresign } from '@/features/facebook/shared/media-upload'
import { TimezoneSelect } from '@/components/dashboard/timezone-select'
import { format, addMinutes } from 'date-fns'

type PostType = 'text' | 'image' | 'video'

interface InappComposerDialogProps {
  pageId: string
  children: React.ReactNode
}

export function InappComposerDialog({ pageId, children }: InappComposerDialogProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  
  const [postType, setPostType] = useState<PostType>('text')
  const [caption, setCaption] = useState('')
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  
  // Date/Time
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone)

  // Upload state
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadedKey, setUploadedKey] = useState<string | null>(null)
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (open) {
      // Default to 1 hour from now
      const defaultTime = addMinutes(new Date(), 60)
      setScheduleDate(format(defaultTime, 'yyyy-MM-dd'))
      setScheduleTime(format(defaultTime, 'HH:mm'))
    }
  }, [open])

  function resetState() {
    setPostType('text')
    setCaption('')
    setMediaFile(null)
    setUploadedKey(null)
    setMediaPreviewUrl(null)
    setIsUploading(false)
    setUploadProgress(0)
  }

  async function handleUpload(file: File) {
    if (isUploading || uploadedKey) return
    setIsUploading(true)
    setUploadProgress(0)

    try {
      const typeStr = postType === 'video' ? 'videos' : 'images'
      const objectKey = await uploadViaPresign({
        file,
        feature: 'inapp-schedule',
        onProgress: (pct: number) => setUploadProgress(pct),
      })
      setUploadedKey(objectKey)
    } catch (err) {
      toast.error('Upload failed', { description: 'Could not upload media. Please try again.' })
      removeMedia()
    } finally {
      setIsUploading(false)
    }
  }

  useEffect(() => {
    if (mediaFile && (postType === 'image' || postType === 'video')) {
      const url = URL.createObjectURL(mediaFile)
      setMediaPreviewUrl(url)
      handleUpload(mediaFile)
      return () => URL.revokeObjectURL(url)
    }
    return () => {}
  }, [mediaFile, postType])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (postType === 'image' && !file.type.startsWith('image/')) {
        toast.error('Invalid file', { description: 'Please select an image file.' })
        return
      }
      if (postType === 'video' && !file.type.startsWith('video/')) {
        toast.error('Invalid file', { description: 'Please select a video file.' })
        return
      }
      setMediaFile(file)
    }
  }

  const removeMedia = () => {
    setMediaFile(null)
    setUploadedKey(null)
    setMediaPreviewUrl(null)
    setUploadProgress(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (postType !== 'text' && !uploadedKey) {
      toast.error('Missing media', { description: 'Please wait for your media to finish uploading.' })
      return
    }

    if (!scheduleDate || !scheduleTime) {
      toast.error('Missing schedule time', { description: 'Please select a date and time.' })
      return
    }

    startTransition(async () => {
      try {
        const res = await fetch('/api/v1/agency/facebook/inapp-schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            savedPageId: pageId,
            mediaType: postType,
            caption,
            mediaObjectKey: uploadedKey,
            scheduledAt: `${scheduleDate}T${scheduleTime}:00`,
            timezone,
          }),
        })

        if (!res.ok) {
          const result = await res.json()
          toast.error('Failed to queue post', { description: result.error || 'Unknown error' })
          return
        }

        toast.success('Post queued successfully')
        setOpen(false)
        resetState()
        router.refresh()
      } catch (err) {
        toast.error('Failed to queue post due to a network error.')
      }
    })
  }

  const isFormValid = () => {
    if (postType !== 'text' && !uploadedKey) return false
    if (!scheduleDate || !scheduleTime) return false
    if (postType === 'text' && !caption.trim()) return false
    return true
  }

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val && isUploading) {
        toast.warning('Upload in progress', { description: 'Please wait for upload to finish.' })
        return
      }
      setOpen(val)
      if (!val) resetState()
    }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl border-0 bg-transparent p-0 shadow-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="overflow-hidden rounded-3xl border border-border/50 bg-card/95 shadow-2xl backdrop-blur-xl"
        >
          <DialogHeader className="border-b border-border/50 bg-muted/10 px-6 py-5">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                <CalendarPlus className="h-6 w-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="font-display text-xl">Queue Post</DialogTitle>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="p-6">
            <div className="space-y-6">
              {/* Type Switcher */}
              <div className="flex w-full gap-2 rounded-xl border border-border/50 bg-muted/30 p-1.5">
                {[
                  { id: 'text', label: 'Text', icon: Type },
                  { id: 'image', label: 'Image', icon: ImageIcon },
                  { id: 'video', label: 'Video', icon: Video },
                ].map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => {
                      if (isUploading) return
                      setPostType(type.id as PostType)
                      if (type.id === 'text') removeMedia()
                    }}
                    disabled={isUploading}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all disabled:opacity-50',
                      postType === type.id
                        ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
                        : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
                    )}
                  >
                    <type.icon className="h-4 w-4" />
                    {type.label}
                  </button>
                ))}
              </div>

              {/* Caption */}
              <div className="space-y-2">
                <Label>Caption</Label>
                <div className="relative">
                  <Textarea
                    placeholder="What do you want to say?"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    className="min-h-[120px] resize-none rounded-xl border-border/50 bg-background/50 focus-visible:ring-primary/20"
                  />
                  <div className="absolute bottom-3 right-3 text-xs text-muted-foreground">
                    {caption.length} / 63,206
                  </div>
                </div>
              </div>

              {/* Media Upload */}
              <AnimatePresence>
                {postType !== 'text' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-2">
                      <Label>Media</Label>
                      {!mediaFile ? (
                        <div
                          className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/50 bg-background/30 py-10 transition-colors hover:border-primary/50 hover:bg-muted/30"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                            <UploadCloud className="h-6 w-6 text-primary" />
                          </div>
                          <p className="mt-4 text-sm font-medium">Click to upload media</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {postType === 'image' ? 'Images up to 10MB' : 'Videos up to 10GB'}
                          </p>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept={postType === 'image' ? 'image/*' : 'video/*'}
                            className="hidden"
                            onChange={handleFileChange}
                          />
                        </div>
                      ) : (
                        <div className="relative mt-2 flex items-center gap-4 rounded-xl border border-border/50 bg-background/50 p-4">
                          {mediaPreviewUrl && postType === 'image' ? (
                            <img
                              src={mediaPreviewUrl}
                              alt="Preview"
                              className="h-16 w-16 rounded-lg object-cover ring-1 ring-border"
                            />
                          ) : (
                            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted ring-1 ring-border">
                              <FileCheck className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{mediaFile.name}</p>
                            <div className="mt-2 flex items-center gap-2">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                <motion.div
                                  className="h-full bg-primary transition-all duration-300"
                                  style={{ width: `${uploadProgress}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium text-muted-foreground w-8 text-right">
                                {Math.round(uploadProgress)}%
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {uploadedKey && (
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                                <CheckCircle2 className="h-5 w-5" />
                              </div>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={removeMedia}
                              disabled={isUploading}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Schedule Details */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="flex h-11 w-full rounded-xl border border-border/50 bg-background/50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Time</Label>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="flex h-11 w-full rounded-xl border border-border/50 bg-background/50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
                <div className="col-span-full space-y-2">
                  <Label>Timezone</Label>
                  <TimezoneSelect value={timezone} onValueChange={setTimezone} />
                </div>
              </div>

            </div>

            <div className="mt-8 flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!isFormValid() || isUploading || isPending}
                loading={isPending}
                className="rounded-xl px-8"
              >
                Queue Post
              </Button>
            </div>
          </form>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
