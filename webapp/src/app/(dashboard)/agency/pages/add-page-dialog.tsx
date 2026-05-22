'use client'

import { useState, useTransition, useEffect } from 'react'
import { createPage, createPagesBulk } from './actions'
import { TimezoneSelect } from '@/components/dashboard/timezone-select'
import { TimeSlotInput } from '@/components/dashboard/time-slot-input'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, Facebook, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FacebookAccount, FacebookGraphPage } from '@/types/app.types'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'

type BulkSourceConfig = {
  sourceUsername: string
  sourcePlatform: 'instagram' | 'youtube' | 'tiktok' | 'facebook'
}

type SourcePlatform = 'instagram' | 'youtube' | 'tiktok' | 'facebook'
type BulkScheduleType = 'dailyrandom' | 'fixed'
type BulkTimingScope = 'all' | 'separate'

type BulkScheduleConfig = {
  postsPerDay: number
  timezone: string
  postingTimes: string[]
}

function sourceIdentityPlaceholder(platform: SourcePlatform): string {
  if (platform === 'youtube') return 'channel_id'
  if (platform === 'facebook') return 'page_or_user_id'
  return '@username'
}

export function AddPageDialog({ agencyId }: { agencyId: string }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [timezone, setTimezone] = useState('Asia/Karachi')
  const [platform, setPlatform] = useState<SourcePlatform>('instagram')
  const [postsPerDay, setPostsPerDay] = useState('1')
  const [mode, setMode] = useState<'single' | 'bulk'>('single')

  const [fbAccounts, setFbAccounts] = useState<FacebookAccount[]>([])
  const [accountSearch, setAccountSearch] = useState('')
  const [pageSearch, setPageSearch] = useState('')
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [fbPages, setFbPages] = useState<FacebookGraphPage[]>([])
  const [isLoadingPages, setIsLoadingPages] = useState(false)
  const [selectedPage, setSelectedPage] = useState<FacebookGraphPage | null>(null)
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([])
  const [bulkSourceConfig, setBulkSourceConfig] = useState<Record<string, BulkSourceConfig>>({})
  const [bulkPlatformForEmpty, setBulkPlatformForEmpty] = useState<SourcePlatform>('instagram')
  const [bulkScheduleType, setBulkScheduleType] = useState<BulkScheduleType>('dailyrandom')
  const [bulkTimingScope, setBulkTimingScope] = useState<BulkTimingScope>('all')
  const [bulkScheduleAll, setBulkScheduleAll] = useState<BulkScheduleConfig>({
    postsPerDay: 1,
    timezone: 'Asia/Karachi',
    postingTimes: [],
  })
  const [bulkScheduleByPage, setBulkScheduleByPage] = useState<Record<string, BulkScheduleConfig>>({})
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false)
  const [step, setStep] = useState(1)

  function ensurePostingTimesLength(times: string[], postsPerDay: number): string[] {
    const next = [...times]
    if (postsPerDay > next.length) {
      for (let i = next.length; i < postsPerDay; i++) next.push('')
    } else if (postsPerDay < next.length) {
      next.splice(postsPerDay)
    }
    return next
  }

  function createBulkScheduleConfig(): BulkScheduleConfig {
    return {
      postsPerDay: 1,
      timezone: 'Asia/Karachi',
      postingTimes: [],
    }
  }

  useEffect(() => {
    if (open) {
      loadAccounts()
    }
  }, [open])

  async function loadAccounts() {
    setIsLoadingAccounts(true)
    try {
      const res = await fetch('/api/v1/agency/facebook/accounts')
      const result = await res.json()
      if (res.ok && result.accounts) {
        setFbAccounts(result.accounts)
      } else {
        toast.error('Failed to load accounts', {
          description: result.error || 'Failed to load accounts',
        })
      }
    } catch {
      toast.error('Failed to load accounts', {
        description: 'An unexpected error occurred',
      })
    } finally {
      setIsLoadingAccounts(false)
    }
  }

  async function handleAccountChange(accountId: string) {
    setSelectedAccountId(accountId)
    setStep(1)
    setSelectedPage(null)
    setSelectedPageIds([])
    setBulkSourceConfig({})
    setBulkScheduleByPage({})
    setFbPages([])
    if (!accountId) return

    setIsLoadingPages(true)
    setError(null)
    try {
      const res = await fetch(`/api/v1/agency/facebook/accounts/${accountId}/pages`)
      const result = await res.json()
      if (res.ok && result.pages) {
        setFbPages(result.pages)
      } else {
        const errorMsg = result.error || 'Failed to fetch pages'
        setError(errorMsg)
        toast.error('Failed to fetch pages', {
          description: errorMsg,
        })
      }
    } catch {
      const errorMsg = 'An unexpected error occurred while fetching pages'
      setError(errorMsg)
      toast.error('Error', {
        description: errorMsg,
      })
    } finally {
      setIsLoadingPages(false)
    }
  }

  const selectedPages = fbPages.filter((page) => selectedPageIds.includes(page.id))

  function togglePageSelection(page: FacebookGraphPage) {
    setSelectedPageIds((prev) => {
      if (prev.includes(page.id)) return prev.filter((id) => id !== page.id)
      return [...prev, page.id]
    })

    setBulkSourceConfig((prev) => ({
      ...prev,
      [page.id]: prev[page.id] || {
        sourceUsername: '',
        sourcePlatform: platform,
      },
    }))

    setBulkScheduleByPage((prev) => ({
      ...prev,
      [page.id]: prev[page.id] || createBulkScheduleConfig(),
    }))
  }

  function selectAllPages() {
    const allIds = fbPages.map((page) => page.id)
    setSelectedPageIds(allIds)
    setBulkSourceConfig((prev) => {
      const next = { ...prev }
      for (const page of fbPages) {
        next[page.id] = next[page.id] || {
          sourceUsername: '',
          sourcePlatform: platform,
        }
      }
      return next
    })
    setBulkScheduleByPage((prev) => {
      const next = { ...prev }
      for (const page of fbPages) {
        next[page.id] = next[page.id] || createBulkScheduleConfig()
      }
      return next
    })
  }

  function clearPageSelection() {
    setSelectedPageIds([])
    setBulkSourceConfig({})
    setBulkScheduleByPage({})
  }

  function resetDialogState() {
    setOpen(false)
    setStep(1)
    setMode('single')
    setError(null)
    setSelectedAccountId('')
    setSelectedPage(null)
    setSelectedPageIds([])
    setBulkSourceConfig({})
    setFbPages([])
    setBulkScheduleType('dailyrandom')
    setBulkTimingScope('all')
    setBulkScheduleAll({
      postsPerDay: 1,
      timezone: 'Asia/Karachi',
      postingTimes: [],
    })
    setBulkScheduleByPage({})
  }

  function handleModeChange(nextMode: 'single' | 'bulk') {
    setMode(nextMode)
    setStep(1)
    setSelectedPage(null)
    setSelectedPageIds([])
    setBulkSourceConfig({})
    setBulkScheduleType('dailyrandom')
    setBulkTimingScope('all')
    setBulkScheduleAll({
      postsPerDay: 1,
      timezone: 'Asia/Karachi',
      postingTimes: [],
    })
    setBulkScheduleByPage({})
    setError(null)
  }

  function updateBulkSource(pageId: string, patch: Partial<BulkSourceConfig>) {
    setBulkSourceConfig((prev) => ({
      ...prev,
      [pageId]: {
        sourceUsername: prev[pageId]?.sourceUsername || '',
        sourcePlatform: prev[pageId]?.sourcePlatform || 'instagram',
        ...patch,
      },
    }))
  }

  function applyPlatformToEmptySources() {
    setBulkSourceConfig((prev) => {
      const next = { ...prev }
      for (const page of selectedPages) {
        const current = next[page.id] || {
          sourceUsername: '',
          sourcePlatform: 'instagram' as SourcePlatform,
        }
        if (!current.sourceUsername.trim()) {
          next[page.id] = {
            ...current,
            sourcePlatform: bulkPlatformForEmpty,
          }
        }
      }
      return next
    })
  }

  function handleNext(e: React.MouseEvent) {
    e.preventDefault()
    if (mode === 'single') {
      if (!selectedPage) {
        setError('Please select a Facebook page before proceeding.')
        return
      }
      setError(null)
      setStep(2)
      return
    }

    if (step === 1) {
      if (selectedPages.length === 0) {
        setError('Please select at least one Facebook page before proceeding.')
        return
      }
      setError(null)
      setStep(2)
      return
    }

    if (step === 2) {
      const invalid = selectedPages.find((page) => !(bulkSourceConfig[page.id]?.sourceUsername || '').trim())
      if (invalid) {
        setError(`Please add source username for "${invalid.name}".`)
        return
      }
      setError(null)
      setStep(3)
    }
  }

  function updateBulkScheduleType(nextType: BulkScheduleType) {
    setBulkScheduleType(nextType)
    if (nextType === 'dailyrandom') {
      setBulkScheduleAll((prev) => ({ ...prev, postingTimes: [] }))
      setBulkScheduleByPage((prev) => {
        const next = { ...prev }
        for (const [pageId, config] of Object.entries(next)) {
          next[pageId] = { ...config, postingTimes: [] }
        }
        return next
      })
      return
    }

    setBulkScheduleAll((prev) => ({
      ...prev,
      postingTimes: ensurePostingTimesLength(prev.postingTimes, prev.postsPerDay),
    }))
    setBulkScheduleByPage((prev) => {
      const next = { ...prev }
      for (const [pageId, config] of Object.entries(next)) {
        next[pageId] = {
          ...config,
          postingTimes: ensurePostingTimesLength(config.postingTimes, config.postsPerDay),
        }
      }
      return next
    })
  }

  function updateBulkAllPostsPerDay(value: string) {
    const postsPerDay = Number.parseInt(value, 10)
    setBulkScheduleAll((prev) => ({
      ...prev,
      postsPerDay,
      postingTimes: bulkScheduleType === 'fixed'
        ? ensurePostingTimesLength(prev.postingTimes, postsPerDay)
        : [],
    }))
  }

  function updateBulkAllPostingTime(index: number, value: string) {
    setBulkScheduleAll((prev) => {
      const next = ensurePostingTimesLength(prev.postingTimes, prev.postsPerDay)
      next[index] = value
      return { ...prev, postingTimes: next }
    })
  }

  function updateBulkPagePostsPerDay(pageId: string, value: string) {
    const postsPerDay = Number.parseInt(value, 10)
    setBulkScheduleByPage((prev) => {
      const current = prev[pageId] || createBulkScheduleConfig()
      return {
        ...prev,
        [pageId]: {
          ...current,
          postsPerDay,
          postingTimes: bulkScheduleType === 'fixed'
            ? ensurePostingTimesLength(current.postingTimes, postsPerDay)
            : [],
        },
      }
    })
  }

  function updateBulkPageTimezone(pageId: string, timezoneValue: string) {
    setBulkScheduleByPage((prev) => {
      const current = prev[pageId] || createBulkScheduleConfig()
      return {
        ...prev,
        [pageId]: {
          ...current,
          timezone: timezoneValue,
        },
      }
    })
  }

  function updateBulkPagePostingTime(pageId: string, index: number, value: string) {
    setBulkScheduleByPage((prev) => {
      const current = prev[pageId] || createBulkScheduleConfig()
      const nextTimes = ensurePostingTimesLength(current.postingTimes, current.postsPerDay)
      nextTimes[index] = value
      return {
        ...prev,
        [pageId]: {
          ...current,
          postingTimes: nextTimes,
        },
      }
    })
  }

  const handleSubmit = (formData: FormData) => {
    setError(null)
    startTransition(async () => {
      formData.set('agencyId', agencyId)
      formData.set('facebookAccountId', selectedAccountId)

      if (mode === 'single') {
        if (!selectedPage) {
          setError('Please select a Facebook page.')
          return
        }

        formData.set('postsPerDay', postsPerDay)
        formData.set('timezone', timezone)

        formData.set('fbPageId', selectedPage.id)
        formData.set('pageName', selectedPage.name)
        formData.set('fbPageAccessToken', selectedPage.access_token)
        formData.set('fbPageImage', selectedPage.picture || '')
        formData.set('followersCount', `${selectedPage.followers_count || 0}`)
        formData.set('sourcePlatform', platform)

        const result = await createPage(formData)
        if (result?.error) {
          setError(result.error)
          toast.error('Failed to create page', { description: result.error })
          return
        }

        toast.success('Page created successfully', {
          description: `${selectedPage.name} has been added and automation will start soon.`,
        })
      } else {
        const pagesPayload = selectedPages.map((page) => ({
          ...(() => {
            const scheduleConfig = bulkTimingScope === 'all'
              ? bulkScheduleAll
              : (bulkScheduleByPage[page.id] || createBulkScheduleConfig())
            return {
              postsPerDay: scheduleConfig.postsPerDay,
              timezone: scheduleConfig.timezone,
              scheduleType: bulkScheduleType,
              postingTimes: bulkScheduleType === 'fixed' ? scheduleConfig.postingTimes : [],
            }
          })(),
          pageName: page.name,
          fbPageId: page.id,
          fbPageAccessToken: page.access_token,
          fbPageImage: page.picture || '',
          followersCount: page.followers_count || 0,
          sourceUsername: (bulkSourceConfig[page.id]?.sourceUsername || '').trim(),
          sourcePlatform: bulkSourceConfig[page.id]?.sourcePlatform || 'instagram',
        }))

        const invalid = pagesPayload.find((p) => !p.sourceUsername)
        if (invalid) {
          setError(`Please add source username for "${invalid.pageName}".`)
          return
        }

        const invalidSchedule = pagesPayload.find((p) => !p.timezone || !Number.isInteger(p.postsPerDay) || p.postsPerDay < 1)
        if (invalidSchedule) {
          setError(`Please complete timezone and posts per day for "${invalidSchedule.pageName}".`)
          return
        }

        if (bulkScheduleType === 'fixed') {
          const invalidFixed = pagesPayload.find((p) => p.postingTimes.length !== p.postsPerDay || p.postingTimes.some((time) => !time))
          if (invalidFixed) {
            setError(`Please select all fixed posting times for "${invalidFixed.pageName}".`)
            return
          }
        }

        formData.set('pages', JSON.stringify(pagesPayload))
        const result = await createPagesBulk(formData)

        if (!result.success && result.failed.length > 0) {
          setError(`${result.failed[0].pageName}: ${result.failed[0].reason}`)
          toast.error('Bulk add failed', {
            description: `${result.failed[0].pageName}: ${result.failed[0].reason}`,
          })
          return
        }

        if (result.failed.length > 0) {
          toast.warning('Bulk add partially completed', {
            description: `${result.created.length} created, ${result.failed.length} failed.`,
          })
        } else {
          toast.success('Bulk add completed', {
            description: `${result.created.length} pages were added successfully.`,
          })
        }
      }

      resetDialogState()
    })
  }

  const filteredAccounts = fbAccounts.filter((acc) =>
    (acc.fb_user_name || '').toLowerCase().includes(accountSearch.toLowerCase())
  )
  const filteredPages = fbPages.filter((page) =>
    page.name.toLowerCase().includes(pageSearch.toLowerCase())
  )

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? setOpen(true) : resetDialogState())}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Page
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle>Add New Page</DialogTitle>
          <DialogDescription>
            Step {step} of {mode === 'bulk' ? 3 : 2}:{' '}
            {mode === 'single'
              ? (step === 1 ? 'Select Page' : 'Configure Settings')
              : (step === 1
                ? 'Select Pages'
                : step === 2
                  ? 'Add Source Usernames'
                  : 'Configure Posting Schedule')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={mode === 'single' ? 'default' : 'outline'}
            className="h-8 px-3 text-xs"
            onClick={() => handleModeChange('single')}
          >
            Single Add
          </Button>
          <Button
            type="button"
            variant={mode === 'bulk' ? 'default' : 'outline'}
            className="h-8 px-3 text-xs"
            onClick={() => handleModeChange('bulk')}
          >
            Bulk Add
          </Button>
          <Badge variant="outline" className="ml-auto text-xs">
            {mode === 'single'
              ? selectedPage ? '1 page selected' : 'No page selected'
              : `${selectedPages.length} pages selected`}
          </Badge>
        </div>

        <form action={handleSubmit}>
          <input type="hidden" name="agencyId" value={agencyId} />

          <div className="py-4 space-y-5">
            {step === 1 && (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Select Facebook Account</Label>
                    <Badge variant="outline" className="text-xs font-mono">
                      {fbAccounts.length} Connected
                    </Badge>
                  </div>

                  {isLoadingAccounts ? (
                    <Skeleton className="h-20 w-full rounded-xl" />
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Search connected accounts..."
                          value={accountSearch}
                          onChange={(e) => setAccountSearch(e.target.value)}
                          className="pl-9 h-9 text-xs"
                        />
                      </div>
                      <div className="grid gap-2 max-h-[140px] overflow-y-auto pr-2">
                        {filteredAccounts.map((acc) => (
                          <div
                            key={acc.id}
                            onClick={() => handleAccountChange(acc.id)}
                            className={cn(
                              'group flex items-center justify-between p-3 border rounded-xl cursor-pointer transition-all',
                              selectedAccountId === acc.id
                                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                                : 'border-border/50 hover:border-primary/30 hover:bg-muted/30'
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className="relative h-8 w-8 rounded-full overflow-hidden border">
                                {acc.fb_user_image ? (
                                  <Image src={acc.fb_user_image} alt={acc.fb_user_name || 'Account'} fill className="object-cover" unoptimized />
                                ) : (
                                  <div className="h-full w-full bg-muted flex items-center justify-center">
                                    <Facebook className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-semibold">{acc.fb_user_name}</p>
                                <p className="text-xs text-muted-foreground font-mono">ID: {acc.fb_user_id}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {selectedAccountId && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <Label>{mode === 'single' ? 'Select Managed Page' : 'Select Managed Pages'}</Label>
                      {mode === 'bulk' && fbPages.length > 0 && !isLoadingPages && (
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-8 px-3 text-xs"
                            onClick={selectAllPages}
                            disabled={selectedPageIds.length === fbPages.length}
                          >
                            Select all pages
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-8 px-3 text-xs"
                            onClick={clearPageSelection}
                            disabled={selectedPageIds.length === 0}
                          >
                            Clear
                          </Button>
                        </div>
                      )}
                    </div>
                    {isLoadingPages ? (
                      <div className="grid gap-2">
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-16 w-full rounded-lg" />
                        ))}
                      </div>
                    ) : (
                      <>
                        <div className="relative">
                          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            placeholder="Search pages..."
                            value={pageSearch}
                            onChange={(e) => setPageSearch(e.target.value)}
                            className="pl-9 h-9 text-xs"
                          />
                        </div>
                        <div className="grid gap-2 max-h-[240px] overflow-y-auto pr-2">
                          {filteredPages.map((page) => {
                            const active = mode === 'single'
                              ? selectedPage?.id === page.id
                              : selectedPageIds.includes(page.id)
                            return (
                              <div
                                key={page.id}
                                onClick={() => (mode === 'single' ? setSelectedPage(page) : togglePageSelection(page))}
                                className={cn(
                                  'flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all',
                                  active ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border hover:bg-muted/50'
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  {page.picture ? (
                                    <div className="relative h-10 w-10">
                                      <Image src={page.picture || ''} alt={page.name} fill className="rounded-full object-cover border" unoptimized />
                                    </div>
                                  ) : (
                                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center border">
                                      <Facebook className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                  )}
                                  <div>
                                    <p className="text-sm font-medium">{page.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      ID: {page.id} • {page.followers_count?.toLocaleString() || 0} followers
                                    </p>
                                  </div>
                                </div>
                                {active && <div className="h-2 w-2 rounded-full bg-primary" />}
                              </div>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}

            {step === 2 && mode === 'single' && (
              <div className="space-y-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Platform</Label>
                  <div className="col-span-3">
                    <Select name="sourcePlatform" value={platform} onValueChange={(v: SourcePlatform) => setPlatform(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="instagram">Instagram</SelectItem>
                        <SelectItem value="youtube">YouTube</SelectItem>
                        <SelectItem value="tiktok">TikTok</SelectItem>
                        <SelectItem value="facebook">Facebook</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="sourceUsername" className="text-right pt-2">Source Identity</Label>
                  <div className="col-span-3">
                    <Input id="sourceUsername" name="sourceUsername" placeholder={sourceIdentityPlaceholder(platform)} required />
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right text-xs">Posts Per Day</Label>
                  <div className="col-span-3">
                    <Select name="postsPerDay" value={postsPerDay} onValueChange={setPostsPerDay}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                          <SelectItem key={n} value={n.toString()}>{n} Posts</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right text-xs">Timezone</Label>
                  <div className="col-span-3">
                    <TimezoneSelect name="timezone" value={timezone} onValueChange={setTimezone} />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && mode === 'bulk' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Per-Page Source Mapping</Label>
                  <Badge variant="outline" className="text-xs">{selectedPages.length} pages</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={bulkPlatformForEmpty} onValueChange={(v: SourcePlatform) => setBulkPlatformForEmpty(v)}>
                    <SelectTrigger className="h-9 w-[170px]">
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="youtube">YouTube</SelectItem>
                      <SelectItem value="tiktok">TikTok</SelectItem>
                      <SelectItem value="facebook">Facebook</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9"
                    onClick={applyPlatformToEmptySources}
                  >
                    Apply to empty sources
                  </Button>
                </div>
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-2">
                  {selectedPages.map((page) => (
                    <div key={page.id} className="border rounded-lg p-3 space-y-2">
                      <p className="text-xs font-semibold">{page.name}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Select
                          value={bulkSourceConfig[page.id]?.sourcePlatform || 'instagram'}
                          onValueChange={(value: SourcePlatform) =>
                            updateBulkSource(page.id, { sourcePlatform: value })
                          }
                        >
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="instagram">Instagram</SelectItem>
                            <SelectItem value="youtube">YouTube</SelectItem>
                            <SelectItem value="tiktok">TikTok</SelectItem>
                            <SelectItem value="facebook">Facebook</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder={sourceIdentityPlaceholder(bulkSourceConfig[page.id]?.sourcePlatform || 'instagram')}
                          value={bulkSourceConfig[page.id]?.sourceUsername || ''}
                          onChange={(e) => updateBulkSource(page.id, { sourceUsername: e.target.value })}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && mode === 'bulk' && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Posting Type</Label>
                    <Select value={bulkScheduleType} onValueChange={(value: BulkScheduleType) => updateBulkScheduleType(value)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dailyrandom">Random Posting Times</SelectItem>
                        <SelectItem value="fixed">Fixed Posting Times</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Apply Schedule</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant={bulkTimingScope === 'all' ? 'default' : 'outline'}
                        className="h-9 px-3 text-xs"
                        onClick={() => setBulkTimingScope('all')}
                      >
                        One for all pages
                      </Button>
                      <Button
                        type="button"
                        variant={bulkTimingScope === 'separate' ? 'default' : 'outline'}
                        className="h-9 px-3 text-xs"
                        onClick={() => setBulkTimingScope('separate')}
                      >
                        Set separately
                      </Button>
                    </div>
                  </div>
                </div>

                {bulkTimingScope === 'all' ? (
                  <div className="space-y-4 rounded-lg border p-4">
                    <p className="text-xs font-semibold text-muted-foreground">
                      These settings will be used for all selected pages.
                    </p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs">Posts Per Day</Label>
                        <Select value={bulkScheduleAll.postsPerDay.toString()} onValueChange={updateBulkAllPostsPerDay}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                              <SelectItem key={n} value={n.toString()}>{n} Posts</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Timezone</Label>
                        <TimezoneSelect value={bulkScheduleAll.timezone} onValueChange={(value) => setBulkScheduleAll((prev) => ({ ...prev, timezone: value }))} />
                      </div>
                    </div>

                    {bulkScheduleType === 'fixed' && (
                      <div className="space-y-2">
                        <Label className="text-xs">Fixed Posting Times</Label>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {ensurePostingTimesLength(bulkScheduleAll.postingTimes, bulkScheduleAll.postsPerDay).map((time, index) => (
                            <TimeSlotInput
                              key={`all-time-${index}`}
                              idPrefix={`add-bulk-all-time-${index}`}
                              value={time || ''}
                              onChange={(value) => updateBulkAllPostingTime(index, value)}
                              nextFieldId={
                                index < ensurePostingTimesLength(bulkScheduleAll.postingTimes, bulkScheduleAll.postsPerDay).length - 1
                                  ? `add-bulk-all-time-${index + 1}-field`
                                  : undefined
                              }
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[320px] overflow-y-auto pr-2">
                    {selectedPages.map((page) => {
                      const pageSchedule = bulkScheduleByPage[page.id] || createBulkScheduleConfig()
                      const pageTimes = ensurePostingTimesLength(pageSchedule.postingTimes, pageSchedule.postsPerDay)
                      return (
                        <div key={`schedule-${page.id}`} className="space-y-3 rounded-lg border p-3">
                          <p className="text-xs font-semibold">{page.name}</p>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label className="text-xs">Posts Per Day</Label>
                              <Select value={pageSchedule.postsPerDay.toString()} onValueChange={(value) => updateBulkPagePostsPerDay(page.id, value)}>
                                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                                    <SelectItem key={n} value={n.toString()}>{n} Posts</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Timezone</Label>
                              <TimezoneSelect value={pageSchedule.timezone} onValueChange={(value) => updateBulkPageTimezone(page.id, value)} />
                            </div>
                          </div>

                          {bulkScheduleType === 'fixed' && (
                            <div className="space-y-2">
                              <Label className="text-xs">Fixed Posting Times</Label>
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {pageTimes.map((time, index) => (
                                  <TimeSlotInput
                                    key={`${page.id}-time-${index}`}
                                    idPrefix={`add-bulk-page-${page.id}-time-${index}`}
                                    value={time || ''}
                                    onChange={(value) => updateBulkPagePostingTime(page.id, index, value)}
                                    nextFieldId={
                                      index < pageTimes.length - 1
                                        ? `add-bulk-page-${page.id}-time-${index + 1}-field`
                                        : undefined
                                    }
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {error && <div className="text-destructive text-sm mb-3">{error}</div>}

          <DialogFooter className="flex justify-between sm:justify-between">
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (mode === 'single') {
                    setStep(1)
                    return
                  }
                  setStep((prev) => Math.max(prev - 1, 1))
                }}
              >
                Back
              </Button>
            )}
            <div className="flex-1" />
            {(mode === 'single' && step === 1) || (mode === 'bulk' && step < 3) ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={
                  mode === 'single'
                    ? !selectedPage
                    : step === 1
                      ? selectedPages.length === 0
                      : selectedPages.some((page) => !(bulkSourceConfig[page.id]?.sourceUsername || '').trim())
                }
              >
                Next
              </Button>
            ) : (
              <Button type="submit" loading={isPending}>
                {mode === 'single' ? 'Start Automation' : 'Create Selected Pages'}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
