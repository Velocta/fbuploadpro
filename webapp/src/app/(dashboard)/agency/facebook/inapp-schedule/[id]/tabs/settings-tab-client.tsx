'use client'

import { useState, useTransition, useMemo } from 'react'
import { updateInappPageSettingsAction } from '../../actions'
import { AgencySectionCard } from '@/components/dashboard/agency'
import { PostsPerDayPicker } from '@/components/dashboard/posts-per-day-picker'
import { TimezoneSelect } from '@/components/dashboard/timezone-select'
import { TimeSlotInput } from '@/components/dashboard/time-slot-input'
import { Badge } from '@/components/ui/badge'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Pencil,
  Clock,
  AlertCircle,
  Calendar,
  Key,
  User,
  Facebook
} from 'lucide-react'
import { formatInTimeZone } from 'date-fns-tz'
import { toast } from 'sonner'

export type InappPageSettingsData = {
  id: string
  fb_page_name: string
  fb_page_image: string | null
  fb_page_id: string
  posts_per_day: number | null
  schedule_timezone: string | null
  posting_times: string[] | null
  facebook_accounts: {
    fb_user_name: string
    fb_user_id: string
    fb_user_image: string | null
  } | null
}

function formatUtcTimeForTimezone(utcTime: string, timezone: string): string {
  const [hours, minutes] = utcTime.split(':')
  if (!hours || !minutes) return utcTime
  try {
    const date = new Date()
    date.setUTCHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0)
    return formatInTimeZone(date, timezone, 'hh:mm a')
  } catch {
    return utcTime
  }
}

export function SettingsTabClient({ page }: { page: InappPageSettingsData }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  // Local state for automation fields
  const [localPostsPerDay, setLocalPostsPerDay] = useState(page.posts_per_day || 2)
  const [localTimezone, setLocalTimezone] = useState(page.schedule_timezone || 'UTC')
  const [localPostingTimes, setLocalPostingTimes] = useState<string[]>(() => {
    const times = Array.isArray(page.posting_times) ? page.posting_times : []
    return times.map((utcTime) =>
      formatUtcTimeForTimezone(utcTime, page.schedule_timezone || 'UTC')
    )
  })

  // Display times (Converted to Local)
  const displayPostingTimes = useMemo(() => {
    const times = Array.isArray(page.posting_times) ? page.posting_times : []
    if (times.length === 0) return null

    return times.map((utcTime) =>
      formatUtcTimeForTimezone(utcTime, page.schedule_timezone || 'UTC')
    )
  }, [page.posting_times, page.schedule_timezone])

  const handleSettingsSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isPending) return
    setError(null)

    if (localPostsPerDay === 0) {
      setError("Please select the number of posts per day.")
      return
    }
    if (localPostingTimes.some(t => !t)) {
      setError("Please select a time for all posting slots.")
      return
    }

    const formData = new FormData()
    formData.set('pageId', page.id)
    formData.set('postsPerDay', localPostsPerDay.toString())
    formData.set('timezone', localTimezone)
    formData.set('postingTimes', JSON.stringify(localPostingTimes))

    startTransition(async () => {
      const result = await updateInappPageSettingsAction(formData)
      if (result?.error) {
        setError(result.error)
        toast.error('Failed to update settings', {
          description: result.error,
        })
      } else {
        setIsEditing(false)
        toast.success('Settings updated', {
          description: 'Your In-App schedule settings have been saved successfully.',
        })
      }
    })
  }

  const resetAutomation = () => {
    setIsEditing(false)
    setLocalPostsPerDay(page.posts_per_day || 2)
    setLocalTimezone(page.schedule_timezone || 'UTC')

    const times = Array.isArray(page.posting_times) ? page.posting_times : []
    setLocalPostingTimes(
      times.map((utcTime) => formatUtcTimeForTimezone(utcTime, page.schedule_timezone || 'UTC'))
    )
  }

  const updatePostsPerDay = (count: number) => {
    setLocalPostsPerDay(count)
    const newTimes = [...localPostingTimes]
    if (count > newTimes.length) {
      for (let i = newTimes.length; i < count; i++) {
        newTimes.push("")
      }
    } else if (count < newTimes.length) {
      newTimes.splice(count)
    }
    setLocalPostingTimes(newTimes)
  }

  const updateTimeSlot = (index: number, value: string) => {
    const newTimes = [...localPostingTimes]
    newTimes[index] = value
    setLocalPostingTimes(newTimes)
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md flex items-center gap-3 animate-in fade-in zoom-in duration-300">
          <AlertCircle className="h-4 w-4" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <Tabs defaultValue="automation" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-xl border border-border/50 bg-muted/50 p-1 sm:max-w-[480px]">
          <TabsTrigger value="automation" className="text-xs flex items-center gap-1.5 py-2">
            <Calendar className="h-3.5 w-3.5" /> Schedule
          </TabsTrigger>
          <TabsTrigger value="connections" className="text-xs flex items-center gap-1.5 py-2">
            <Key className="h-3.5 w-3.5" /> Connections
          </TabsTrigger>
          <TabsTrigger value="identity" className="text-xs flex items-center gap-1.5 py-2">
            <User className="h-3.5 w-3.5" /> Identity
          </TabsTrigger>
        </TabsList>

        {/* 1. Schedule Settings */}
        <TabsContent value="automation" forceMount className="mt-4 animate-in slide-in-from-left-2 duration-300 data-[state=inactive]:hidden">
          <form onSubmit={handleSettingsSubmit}>
            <AgencySectionCard className="rounded-2xl border-border/50 bg-card/40 shadow-2xl backdrop-blur-xl">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm">Queue Slots Settings</CardTitle>
                  <CardDescription className="text-xs">Manage localized posting slots and times for this page&apos;s queue.</CardDescription>
                </div>
                {!isEditing && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="h-9 rounded-xl text-xs"
                  >
                    <Pencil className="h-3 w-3 mr-1.5" /> Edit Settings
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                {!isEditing ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Posts Per Day</p>
                      <p className="text-sm font-semibold">{page.posts_per_day || 0} Slots</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Posting Timezone</p>
                      <p className="text-sm font-semibold">{page.schedule_timezone || 'UTC'}</p>
                    </div>
                    <div className="col-span-full pt-2">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Configured Timeslots (Local)</p>
                      {displayPostingTimes ? (
                        <div className="flex flex-wrap gap-2">
                          {displayPostingTimes.map((time, i) => (
                            <Badge key={i} variant="secondary" className="font-mono text-xs py-1 px-2 flex items-center gap-1.5 bg-primary/10 text-primary border-primary/20">
                              <Clock className="h-3 w-3" /> {time}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No posting times configured.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Posting Timezone</Label>
                        <TimezoneSelect value={localTimezone} onValueChange={setLocalTimezone} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">Posts Per Day</Label>
                        <PostsPerDayPicker
                          value={localPostsPerDay > 0 ? localPostsPerDay : 1}
                          onValueChange={(v) => updatePostsPerDay(parseInt(v, 10))}
                        />
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <Label className="text-xs font-bold uppercase tracking-wider">Configure Slots ({localPostingTimes.length})</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {localPostingTimes.map((time, index) => (
                          <div key={index} className="flex items-center gap-2 group">
                            <div className="flex-1">
                              <TimeSlotInput
                                idPrefix={`inapp-settings-page-${page.id}-slot-${index}`}
                                value={time || ''}
                                onChange={(v) => updateTimeSlot(index, v)}
                                nextFieldId={
                                  index < localPostingTimes.length - 1
                                    ? `inapp-settings-page-${page.id}-slot-${index + 1}-field`
                                    : undefined
                                }
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-11 rounded-xl"
                        onClick={resetAutomation}
                        disabled={isPending}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" className="h-11 rounded-xl" loading={isPending}>
                        Save Changes
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </AgencySectionCard>
          </form>
        </TabsContent>

        {/* 2. Connections */}
        <TabsContent value="connections" forceMount className="mt-4 animate-in slide-in-from-left-2 duration-300 data-[state=inactive]:hidden">
          <AgencySectionCard className="rounded-2xl border-border/50 bg-card/40 shadow-2xl backdrop-blur-xl">
            <CardHeader>
              <div>
                <CardTitle className="text-sm text-primary">Facebook Connection</CardTitle>
                <CardDescription className="text-xs">Associated Facebook profile acting as moderator.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Admin Account</Label>
                  <div className="flex items-center p-3 rounded-md bg-primary/5 border border-primary/10">
                    {page.facebook_accounts?.fb_user_image ? (
                      <div className="relative h-8 w-8 rounded-full border border-primary/20 mr-2.5 overflow-hidden">
                        <Image
                          src={page.facebook_accounts.fb_user_image}
                          alt=""
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <Facebook className="h-4 w-4 text-primary mr-2.5" />
                    )}
                    <div>
                      <p className="text-sm font-semibold text-primary leading-none">
                        {page.facebook_accounts?.fb_user_name || 'Disconnected'}
                      </p>
                      <p className="mt-1 text-xs text-primary/70 font-mono">
                        UID: {page.facebook_accounts?.fb_user_id || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </AgencySectionCard>
        </TabsContent>

        {/* 3. Identity */}
        <TabsContent value="identity" forceMount className="mt-4 animate-in slide-in-from-left-2 duration-300 data-[state=inactive]:hidden">
          <AgencySectionCard className="rounded-2xl border-border/50 bg-card/40 shadow-2xl backdrop-blur-xl">
            <CardHeader>
              <div>
                <CardTitle className="text-sm">Facebook Page Info</CardTitle>
                <CardDescription className="text-xs">Graph API metadata for identification.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Page Name</Label>
                  <Input value={page.fb_page_name} disabled className="h-9" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Facebook Page ID</Label>
                  <Input value={page.fb_page_id} disabled className="h-9" />
                </div>
              </div>
            </CardContent>
          </AgencySectionCard>
        </TabsContent>
      </Tabs>
    </div>
  )
}
