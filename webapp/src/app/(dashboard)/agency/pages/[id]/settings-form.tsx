'use client'

import { useState, useTransition, useMemo } from 'react'
import { updatePageSettings, updateSourceUsername } from './actions'
import { TimezoneSelect } from '@/components/dashboard/timezone-select'
import { TimeSlotInput } from '@/components/dashboard/time-slot-input'
import { Badge } from '@/components/ui/badge'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Instagram,
  Pencil,
  Clock,
  AlertCircle,
  Calendar,
  Key,
  User,
  Facebook,
  RefreshCcw,
  Youtube,
  Music
} from 'lucide-react'
import { formatInTimeZone } from 'date-fns-tz'
import { toast } from 'sonner'

export type Page = {
  id: string
  page_name: string
  source_platform: 'instagram' | 'youtube' | 'tiktok' | 'facebook'
  source_username: string
  fb_page_access_token: string | null
  fb_page_id: string
  posts_per_day: number | null
  schedule_type: 'fixed' | 'randomfixed' | 'dailyrandom' | null
  status: string | null
  timezone: string
  posting_times: string[] | null // Json type from DB, expected string[]
  facebook_accounts: {
    fb_user_name: string
    fb_user_id: string
    fb_user_image: string | null
  } | null
  fb_page_image: string | null
}

type SourcePlatform = 'instagram' | 'youtube' | 'tiktok' | 'facebook'

function sourceIdentityLabel(platform: SourcePlatform, sourceUsername: string): string {
  return platform === 'facebook' ? sourceUsername : `@${sourceUsername}`
}

function sourceIdentityPlaceholder(platform: SourcePlatform): string {
  if (platform === 'youtube') return 'channel_id'
  if (platform === 'facebook') return 'page_or_user_id'
  return '@username'
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

export function SettingsForm({ profile }: { profile: Page }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [isEditingAutomation, setIsEditingAutomation] = useState(false)
  const [isEditingIdentity, setIsEditingIdentity] = useState(false)

  const [sourceDialogOpen, setSourceDialogOpen] = useState(false)
  const [newSourceUsername, setNewSourceUsername] = useState('')
  const [newSourcePlatform, setNewSourcePlatform] = useState<SourcePlatform>(profile.source_platform)

  // Local state for automation fields while editing
  const [localPostsPerDay, setLocalPostsPerDay] = useState(profile.posts_per_day || 0)
  const [localScheduleType, setLocalScheduleType] = useState(profile.schedule_type || 'dailyrandom')
  const [localTimezone, setLocalTimezone] = useState(profile.timezone || 'UTC')
  const [localPostingTimes, setLocalPostingTimes] = useState<string[]>(() => {
    const times = Array.isArray(profile.posting_times) ? profile.posting_times : []
    // Convert UTC times from DB to Local Time for editing
    return times.map((utcTime) =>
      formatUtcTimeForTimezone(utcTime, profile.timezone || 'UTC')
    )
  })

  // Display times (Converted to Local)
  const displayPostingTimes = useMemo(() => {
    const times = Array.isArray(profile.posting_times) ? profile.posting_times : []
    if (times.length === 0) return null

    return times.map((utcTime) =>
      formatUtcTimeForTimezone(utcTime, profile.timezone || 'UTC')
    )
  }, [profile.posting_times, profile.timezone])

  // Local state for Connections

  // Local state for Identity
  const [localPageName, setLocalPageName] = useState(profile.page_name || '')

  const handleSettingsSubmit = (e: React.FormEvent<HTMLFormElement>, tab: string) => {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)

    if (tab === 'automation') {
      if (localScheduleType === 'fixed') {
        if (localPostsPerDay === 0) {
          setError("Please select the number of posts per day.")
          return
        }
        if (localPostingTimes.some(t => !t)) {
          setError("Please select a time for all posting slots.")
          return
        }
      }
      // Pass raw AM/PM strings to backend as requested
      formData.set('postingTimes', JSON.stringify(localPostingTimes))
      formData.set('postsPerDay', localPostsPerDay.toString())
      formData.set('scheduleType', localScheduleType)
      formData.set('timezone', localTimezone)
    }

    startTransition(async () => {
      const result = await updatePageSettings(formData)
      if (result?.error) {
        setError(result.error)
        toast.error('Failed to update settings', {
          description: result.error,
        })
      } else {
        if (tab === 'automation') setIsEditingAutomation(false)
        if (tab === 'identity') setIsEditingIdentity(false)
        toast.success('Settings updated', {
          description: `Your ${tab} settings have been saved successfully.`,
        })
      }
    })
  }

  const resetAutomation = () => {
    setIsEditingAutomation(false)
    setLocalPostsPerDay(profile.posts_per_day || 0)
    setLocalScheduleType(profile.schedule_type || 'dailyrandom')
    setLocalTimezone(profile.timezone || 'UTC')

    const times = Array.isArray(profile.posting_times) ? profile.posting_times : []
    setLocalPostingTimes(
      times.map((utcTime) => formatUtcTimeForTimezone(utcTime, profile.timezone || 'UTC'))
    )
  }


  const resetIdentity = () => {
    setIsEditingIdentity(false)
    setLocalPageName(profile.page_name || '')
  }

  const handleSourceUpdate = () => {
    setError(null)
    if (!newSourceUsername.trim()) {
      setError("Please enter a valid source username.")
      toast.error('Validation Error', {
        description: 'Please enter a valid source username.',
      })
      return
    }
    startTransition(async () => {
      const result = await updateSourceUsername(profile.id, newSourceUsername, newSourcePlatform)
      if (result?.error) {
        setError(result.error)
        toast.error('Failed to update source', {
          description: result.error,
        })
      } else {
        toast.success('Source updated', {
          description: `Source identity has been updated to ${sourceIdentityLabel(newSourcePlatform, newSourceUsername)}.`,
        })
        setSourceDialogOpen(false)
        setNewSourceUsername('')
      }
    })
  }

  const updatePostsPerDay = (count: number) => {
    setLocalPostsPerDay(count)
    if (localScheduleType === 'fixed') {
      // Adjust slots to match count
      const newTimes = [...localPostingTimes]
      if (count > newTimes.length) {
        // Add default slots as empty to force selection
        for (let i = newTimes.length; i < count; i++) {
          newTimes.push("")
        }
      } else if (count < newTimes.length) {
        // Remove extra slots
        newTimes.splice(count)
      }
      setLocalPostingTimes(newTimes)
    }
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
        <TabsList className="grid w-full grid-cols-4 bg-muted/30 p-1">
          <TabsTrigger value="automation" className="text-xs flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> Automation
          </TabsTrigger>
          <TabsTrigger value="connections" className="text-xs flex items-center gap-1.5">
            <Key className="h-3.5 w-3.5" /> Connections
          </TabsTrigger>
          <TabsTrigger value="source" className="text-xs flex items-center gap-1.5">
            {profile.source_platform === 'instagram' && <Instagram className="h-3.5 w-3.5" />}
            {profile.source_platform === 'youtube' && <Youtube className="h-3.5 w-3.5" />}
            {profile.source_platform === 'tiktok' && <Music className="h-3.5 w-3.5" />}
            {profile.source_platform === 'facebook' && <Facebook className="h-3.5 w-3.5" />}
            Source
          </TabsTrigger>
          <TabsTrigger value="identity" className="text-xs flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" /> Identity
          </TabsTrigger>
        </TabsList>

        {/* 1. Automation Settings */}
        <TabsContent value="automation" forceMount className="mt-4 animate-in slide-in-from-left-2 duration-300 data-[state=inactive]:hidden">
          <form onSubmit={(e) => handleSettingsSubmit(e, 'automation')}>
            <input type="hidden" name="pageId" value={profile.id} />
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm">Posting Settings</CardTitle>
                  <CardDescription className="text-xs">Manage frequency and localized posting times.</CardDescription>
                </div>
                {!isEditingAutomation && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingAutomation(true)}
                    className="h-8 text-xs"
                  >
                    <Pencil className="h-3 w-3 mr-1.5" /> Edit
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                {!isEditingAutomation ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Posts Per Day</p>
                      <p className="text-sm font-semibold">{profile.posts_per_day || 0} Posts</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Logic</p>
                      <p className="text-sm font-semibold capitalize">{profile.schedule_type?.replace('fixed', ' Fixed') || 'Not Set'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Timezone</p>
                      <p className="text-sm font-semibold">{profile.timezone || 'UTC'}</p>
                    </div>
                    <div className="col-span-full pt-2">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scheduled Times (Local)</p>
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
                        <Label className="text-xs">Schedule Logic</Label>
                        <Select value={localScheduleType} onValueChange={(v: "fixed" | "randomfixed" | "dailyrandom") => {
                          setLocalScheduleType(v)
                          if (v === 'dailyrandom') {
                            setLocalPostingTimes([])
                          } else if (v === 'fixed') {
                            // Reset posts per day to force selection and show placeholder
                            setLocalPostsPerDay(0)
                            setLocalPostingTimes([])
                          }
                        }}>
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dailyrandom">Daily Random</SelectItem>
                            <SelectItem value="fixed">Fixed Timestamps</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Posting Timezone</Label>
                        <TimezoneSelect value={localTimezone} onValueChange={setLocalTimezone} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Posts Per Day</Label>
                      <Select
                        value={localPostsPerDay > 0 ? localPostsPerDay.toString() : undefined}
                        onValueChange={(v) => updatePostsPerDay(parseInt(v))}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder="Select posts per day" />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                            <SelectItem key={n} value={n.toString()}>{n} Posts</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {localScheduleType === 'dailyrandom' && (
                      <div className="bg-primary/10 border border-primary/20 p-3 rounded-md">
                        <p className="text-xs text-primary font-medium leading-relaxed">
                          <AlertCircle className="h-3 w-3 inline mr-1 -mt-0.5" />
                          Balanced random times will be automatically generated upon saving to ensure a minimum 5-hour gap between posts.
                        </p>
                      </div>
                    )}

                    {localScheduleType === 'fixed' && (
                      <>
                        <Separator />
                        <div className="space-y-4">
                          <Label className="text-xs font-bold uppercase tracking-wider">Configure Slots ({localPostingTimes.length})</Label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {localPostingTimes.map((time, index) => (
                              <div key={index} className="flex items-center gap-2 group">
                                <div className="flex-1">
                                  <TimeSlotInput
                                    idPrefix={`settings-page-${profile.id}-slot-${index}`}
                                    value={time || ''}
                                    onChange={(v) => updateTimeSlot(index, v)}
                                    nextFieldId={
                                      index < localPostingTimes.length - 1
                                        ? `settings-page-${profile.id}-slot-${index + 1}-field`
                                        : undefined
                                    }
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    <div className="relative h-12 w-12 flex-shrink-0">
                      <Image
                        src={profile.fb_page_image || ''}
                        alt={profile.page_name}
                        fill
                        className="rounded-full object-cover border border-border"
                        unoptimized
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={resetAutomation}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" size="sm" loading={isPending}>
                        Save Changes
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </form>
        </TabsContent>

        {/* 2. Connections */}
        <TabsContent value="connections" forceMount className="mt-4 animate-in slide-in-from-left-2 duration-300 data-[state=inactive]:hidden">
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="text-sm text-primary">Facebook Identity</CardTitle>
                <CardDescription className="text-xs">The Facebook account used to manage this page.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Associated Facebook Identity</Label>
                  <div className="flex items-center p-3 rounded-md bg-primary/5 border border-primary/10">
                    {profile.facebook_accounts?.fb_user_image ? (
                      <div className="relative h-8 w-8 rounded-full border border-primary/20 mr-2.5 overflow-hidden">
                        <Image
                          src={profile.facebook_accounts.fb_user_image}
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
                        {profile.facebook_accounts?.fb_user_name || 'Disconnected'}
                      </p>
                      <p className="mt-1 text-xs text-primary/70 font-mono">
                        UID: {profile.facebook_accounts?.fb_user_id || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. Source Management */}
        <TabsContent value="source" forceMount className="mt-4 animate-in slide-in-from-left-2 duration-300 data-[state=inactive]:hidden">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <RefreshCcw className="h-4 w-4 text-primary" />
                Content Source Management
              </CardTitle>
              <CardDescription className="text-xs">Define where the automation scrapes content from.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between border-2 border-dashed rounded-lg p-6 bg-muted/10">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current Source</p>
                  <p className="text-xl font-bold flex items-center gap-2 text-foreground">
                    {profile.source_platform === 'instagram' && <Instagram className="h-5 w-5 text-[#E4405F]" />}
                    {profile.source_platform === 'youtube' && <Youtube className="h-5 w-5 text-[#FF0000]" />}
                    {profile.source_platform === 'tiktok' && <Music className="h-5 w-5 text-[#00F2EA]" />}
                    {profile.source_platform === 'facebook' && <Facebook className="h-5 w-5 text-[#1877F2]" />}
                    {sourceIdentityLabel(profile.source_platform, profile.source_username)}
                  </p>
                </div>
                <Dialog open={sourceDialogOpen} onOpenChange={setSourceDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="shadow-sm border-border hover:bg-accent" type="button">Update Content Source</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Switch {profile.source_platform.charAt(0).toUpperCase() + profile.source_platform.slice(1)} Source</DialogTitle>
                      <DialogDescription className="text-xs">
                        Update the target source identity to re-sync the automation queue with new content.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Source Platform</Label>
                        <Select value={newSourcePlatform} onValueChange={(v: SourcePlatform) => setNewSourcePlatform(v)}>
                          <SelectTrigger className="h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="instagram">Instagram</SelectItem>
                            <SelectItem value="youtube">YouTube</SelectItem>
                            <SelectItem value="tiktok">TikTok</SelectItem>
                            <SelectItem value="facebook">Facebook</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="newSource" className="text-xs">New Target Identity</Label>
                        <div className="relative">
                          {newSourcePlatform === 'instagram' && <Instagram className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />}
                          {newSourcePlatform === 'youtube' && <Youtube className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />}
                          {newSourcePlatform === 'tiktok' && <Music className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />}
                          {newSourcePlatform === 'facebook' && <Facebook className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />}
                          <Input
                            id="newSource"
                            value={newSourceUsername}
                            onChange={(e) => setNewSourceUsername(e.target.value)}
                            placeholder={sourceIdentityPlaceholder(newSourcePlatform)}
                            className="pl-9 h-10"
                          />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleSourceUpdate} loading={isPending} disabled={!newSourceUsername.trim()} type="button">
                        Confirm Transition
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. Identity */}
        <TabsContent value="identity" forceMount className="mt-4 animate-in slide-in-from-left-2 duration-300 data-[state=inactive]:hidden">
          <form onSubmit={(e) => handleSettingsSubmit(e, 'identity')}>
            <input type="hidden" name="pageId" value={profile.id} />
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm">Page Identity</CardTitle>
                  <CardDescription className="text-xs">Internal identifiers and display names.</CardDescription>
                </div>
                {!isEditingIdentity && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingIdentity(true)}
                    className="h-8 text-xs"
                  >
                    <Pencil className="h-3 w-3 mr-1.5" /> Edit
                  </Button>
                )}
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pageName" className="text-xs">Display Name</Label>
                    <Input id="pageName" name="pageName" value={localPageName} onChange={(e) => setLocalPageName(e.target.value)} required disabled={!isEditingIdentity} className="h-9" />
                  </div>
                </div>
              </CardContent>
              {isEditingIdentity && (
                <CardFooter className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetIdentity}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" loading={isPending}>
                    Save Changes
                  </Button>
                </CardFooter>
              )}
            </Card>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  )
}
