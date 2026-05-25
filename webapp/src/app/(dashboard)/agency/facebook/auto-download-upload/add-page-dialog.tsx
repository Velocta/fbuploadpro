'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { createPage, createPagesBulk } from './actions'
import { TimezoneSelect } from '@/components/dashboard/timezone-select'
import { PostsPerDayPicker } from '@/components/dashboard/posts-per-day-picker'
import { sanitizeSourceIdentityInput } from '@/lib/source-identity'
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
import { Plus, Facebook, Search, Loader2, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FacebookAccount, FacebookGraphPage } from '@/types/app.types'
import { toast } from 'sonner'

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

function LoadingPanel({ message, submessage }: { message: string; submessage?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 px-6 py-10">
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-blue-500/10"
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
        aria-hidden
      />
      <div className="relative flex flex-col items-center gap-4 text-center">
        <div className="relative flex h-14 w-14 items-center justify-center">
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-primary/20"
            animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
          />
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{message}</p>
          {submessage ? <p className="text-xs text-muted-foreground">{submessage}</p> : null}
        </div>
      </div>
    </div>
  )
}

function stepSubtitle(mode: 'single' | 'bulk', step: number): string {
  if (mode === 'single') {
    return step === 1 ? 'Select Page' : 'Configure Settings'
  }
  if (step === 1) return 'Select Pages'
  if (step === 2) return 'Add Source Usernames'
  return 'Configure Posting Schedule'
}

export function AddPageDialog({ agencyId }: { agencyId: string }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [timezone, setTimezone] = useState('Asia/Karachi')
  const [platform, setPlatform] = useState<SourcePlatform>('instagram')
  const [sourceUsername, setSourceUsername] = useState('')
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
  const submittingRef = useRef(false)
  const pagesFetchGeneration = useRef(0)
  const pagesAbortRef = useRef<AbortController | null>(null)

  const isBusy = isPending || isLoadingPages || isLoadingAccounts
  const totalSteps = mode === 'bulk' ? 3 : 2

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
    pagesAbortRef.current?.abort()
    const generation = ++pagesFetchGeneration.current

    setSelectedAccountId(accountId)
    setStep(1)
    setSelectedPage(null)
    setSelectedPageIds([])
    setBulkSourceConfig({})
    setBulkScheduleByPage({})
    setFbPages([])
    if (!accountId) return

    const controller = new AbortController()
    pagesAbortRef.current = controller

    setIsLoadingPages(true)
    setError(null)
    try {
      const res = await fetch(`/api/v1/agency/facebook/accounts/${accountId}/pages`, {
        signal: controller.signal,
      })
      if (generation !== pagesFetchGeneration.current) return

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
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      if (generation !== pagesFetchGeneration.current) return
      const errorMsg = 'An unexpected error occurred while fetching pages'
      setError(errorMsg)
      toast.error('Error', {
        description: errorMsg,
      })
    } finally {
      if (generation === pagesFetchGeneration.current) {
        setIsLoadingPages(false)
      }
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

  function resetDialogState(force = false) {
    if (!force && (isPending || isLoadingPages || isLoadingAccounts)) return
    pagesAbortRef.current?.abort()
    pagesAbortRef.current = null
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
    setPlatform('instagram')
    setSourceUsername('')
    setPostsPerDay('1')
    setTimezone('Asia/Karachi')
  }

  function handleModeChange(nextMode: 'single' | 'bulk') {
    if (isBusy) return
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
    setBulkSourceConfig((prev) => {
      const current = prev[pageId] || {
        sourceUsername: '',
        sourcePlatform: 'instagram' as SourcePlatform,
      }
      const nextPlatform = patch.sourcePlatform ?? current.sourcePlatform
      const rawUsername =
        patch.sourceUsername !== undefined ? patch.sourceUsername : current.sourceUsername
      return {
        ...prev,
        [pageId]: {
          ...current,
          ...patch,
          sourcePlatform: nextPlatform,
          sourceUsername: sanitizeSourceIdentityInput(nextPlatform, rawUsername),
        },
      }
    })
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
    if (submittingRef.current || isPending) return
    submittingRef.current = true
    setError(null)
    startTransition(async () => {
      try {
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
          const firstFailed = result.failed.at(0)
          if (!firstFailed) return
          setError(`${firstFailed.pageName}: ${firstFailed.reason}`)
          toast.error('Bulk add failed', {
            description: `${firstFailed.pageName}: ${firstFailed.reason}`,
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

      resetDialogState(true)
      } finally {
        submittingRef.current = false
      }
    })
  }

  function handleDialogOpenChange(nextOpen: boolean) {
    if (!nextOpen && (isPending || isLoadingPages || isLoadingAccounts)) {
      toast.warning('Please wait', {
        description: 'Finish loading or saving before closing.',
      })
      return
    }
    if (nextOpen) setOpen(true)
    else resetDialogState()
  }

  const filteredAccounts = fbAccounts.filter((acc) =>
    (acc.fb_user_name || '').toLowerCase().includes(accountSearch.toLowerCase())
  )
  const filteredPages = fbPages.filter((page) =>
    page.name.toLowerCase().includes(pageSearch.toLowerCase())
  )

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogTrigger asChild>
        <Button className="group relative h-11 overflow-hidden rounded-xl bg-primary px-6 text-primary-foreground shadow-[0_0_28px_-8px_hsl(var(--primary)/0.55)] ring-1 ring-primary/25 transition-all hover:bg-primary/90 hover:shadow-[0_0_36px_-6px_hsl(var(--primary)/0.65)]">
          <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/15 to-white/0 opacity-0 transition-opacity group-hover:opacity-100" />
          <span className="relative flex items-center">
            <Plus className="mr-2 h-4 w-4" />
            Add Page
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] w-full max-w-[95vw] flex-col overflow-hidden border-0 bg-transparent p-0 shadow-none sm:max-w-[680px]">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="relative flex max-h-[90vh] flex-col overflow-hidden rounded-3xl border border-border/50 bg-card/95 shadow-2xl backdrop-blur-xl"
        >
          <DialogHeader className="space-y-4 border-b border-border/50 px-6 py-5 text-left">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                <Plus className="h-7 w-7 text-primary" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="font-display text-xl">Add New Page</DialogTitle>
                <DialogDescription className="mt-1 text-muted-foreground">
                  Step {step} of {totalSteps}: {stepSubtitle(mode, step)}
                </DialogDescription>
              </div>
            </div>
            <div className="flex gap-1.5">
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
                <div
                  key={s}
                  className={cn(
                    'h-1.5 flex-1 rounded-full transition-all',
                    s <= step ? 'bg-primary' : 'bg-muted',
                  )}
                />
              ))}
            </div>
          </DialogHeader>

          <div className="space-y-4 px-6 pt-4">
            <div className="flex w-full gap-1 rounded-xl border border-border/50 bg-muted/50 p-1">
              {(['single', 'bulk'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={isBusy}
                  className={cn(
                    'flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all disabled:opacity-60',
                    mode === m
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => handleModeChange(m)}
                >
                  {m === 'single' ? 'Single Add' : 'Bulk Add'}
                </button>
              ))}
            </div>
            <Badge variant="outline" className="w-fit text-xs">
              {mode === 'single'
                ? selectedPage
                  ? '1 page selected'
                  : 'No page selected'
                : `${selectedPages.length} pages selected`}
            </Badge>
          </div>

        <form action={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <input type="hidden" name="agencyId" value={agencyId} />

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${mode}-${step}`}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
            {step === 1 && (
              <div className="rounded-2xl border border-border/50 bg-card/40 p-5 backdrop-blur-sm">
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Select Facebook Account</Label>
                    <Badge variant="outline" className="text-xs font-mono">
                      {fbAccounts.length} Connected
                    </Badge>
                  </div>

                  {isLoadingAccounts ? (
                    <LoadingPanel message="Loading accounts…" submessage="Fetching your connected Facebook accounts" />
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search connected accounts..."
                          value={accountSearch}
                          onChange={(e) => setAccountSearch(e.target.value)}
                          className="h-12 rounded-xl border-border/50 bg-background/50 pl-11"
                        />
                      </div>
                      <div className="custom-scrollbar max-h-[200px] space-y-2 overflow-y-auto pr-2">
                        {filteredAccounts.map((acc) => (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => handleAccountChange(acc.id)}
                            className={cn(
                              'group flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all',
                              selectedAccountId === acc.id
                                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                                : 'border-border/50 hover:border-primary/30 hover:bg-muted/30',
                            )}
                          >
                            {acc.fb_user_image ? (
                              <Image
                                src={acc.fb_user_image}
                                alt={acc.fb_user_name || 'Account'}
                                width={40}
                                height={40}
                                className="rounded-full ring-2 ring-transparent group-hover:ring-primary/20"
                                unoptimized
                              />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                                <Facebook className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold">{acc.fb_user_name}</p>
                              <p className="font-mono text-xs text-muted-foreground">{acc.fb_user_id}</p>
                            </div>
                            <ArrowRight className="h-4 w-4 shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
                          </button>
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
                      <LoadingPanel message="Loading pages…" submessage="Fetching managed pages for this account" />
                    ) : (
                      <>
                        <div className="relative">
                          <Search className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search pages..."
                            value={pageSearch}
                            onChange={(e) => setPageSearch(e.target.value)}
                            className="h-12 rounded-xl border-border/50 bg-background/50 pl-11"
                          />
                        </div>
                        <div className="custom-scrollbar max-h-[240px] space-y-2 overflow-y-auto pr-2">
                          {filteredPages.map((page) => {
                            const active =
                              mode === 'single'
                                ? selectedPage?.id === page.id
                                : selectedPageIds.includes(page.id)
                            return (
                              <button
                                key={page.id}
                                type="button"
                                onClick={() =>
                                  mode === 'single' ? setSelectedPage(page) : togglePageSelection(page)
                                }
                                className={cn(
                                  'group flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all',
                                  active
                                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                                    : 'border-border/50 hover:border-primary/30 hover:bg-muted/30',
                                )}
                              >
                                {page.picture ? (
                                  <Image
                                    src={page.picture || ''}
                                    alt={page.name}
                                    width={40}
                                    height={40}
                                    className="rounded-lg object-cover ring-2 ring-transparent group-hover:ring-primary/20"
                                    unoptimized
                                  />
                                ) : (
                                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                                    <Facebook className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold">{page.name}</p>
                                  <p className="font-mono text-xs text-muted-foreground">
                                    {page.id} · {page.followers_count?.toLocaleString() || 0} followers
                                  </p>
                                </div>
                                {active ? (
                                  <div className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                                ) : (
                                  <ArrowRight className="h-4 w-4 shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
              </div>
            )}

            {step === 2 && mode === 'single' && (
              <div className="rounded-2xl border border-border/50 bg-card/40 p-5 backdrop-blur-sm">
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
                    <Input
                      id="sourceUsername"
                      name="sourceUsername"
                      value={sourceUsername}
                      onChange={(e) =>
                        setSourceUsername(sanitizeSourceIdentityInput(platform, e.target.value))
                      }
                      placeholder={sourceIdentityPlaceholder(platform)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Posts Per Day</Label>
                  <PostsPerDayPicker
                    name="postsPerDay"
                    value={Number.parseInt(postsPerDay, 10) || 1}
                    onValueChange={setPostsPerDay}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Timezone</Label>
                  <TimezoneSelect name="timezone" value={timezone} onValueChange={setTimezone} />
                </div>
              </div>
              </div>
            )}

            {step === 2 && mode === 'bulk' && (
              <div className="rounded-2xl border border-border/50 bg-card/40 p-5 backdrop-blur-sm">
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
                          onChange={(e) =>
                            updateBulkSource(page.id, { sourceUsername: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              </div>
            )}

            {step === 3 && mode === 'bulk' && (
              <div className="rounded-2xl border border-border/50 bg-card/40 p-5 backdrop-blur-sm">
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
                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-sm font-semibold">Posts Per Day</Label>
                        <PostsPerDayPicker
                          value={bulkScheduleAll.postsPerDay}
                          onValueChange={updateBulkAllPostsPerDay}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-sm font-semibold">Timezone</Label>
                        <TimezoneSelect
                          value={bulkScheduleAll.timezone}
                          onValueChange={(tz) =>
                            setBulkScheduleAll((prev) => ({ ...prev, timezone: tz }))
                          }
                        />
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
                          <div className="grid gap-3">
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold">Posts Per Day</Label>
                              <PostsPerDayPicker
                                value={pageSchedule.postsPerDay}
                                onValueChange={(v) => updateBulkPagePostsPerDay(page.id, v)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold">Timezone</Label>
                              <TimezoneSelect
                                value={pageSchedule.timezone}
                                onValueChange={(value) => updateBulkPageTimezone(page.id, value)}
                              />
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
              </div>
            )}
              </motion.div>
            </AnimatePresence>
          </div>

          {error && (
            <div className="mx-6 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <span className="min-w-0 flex-1">{error}</span>
              <div className="flex shrink-0 gap-2">
                {selectedAccountId && step === 1 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7"
                    disabled={isBusy}
                    onClick={() => {
                      setError(null)
                      void handleAccountChange(selectedAccountId)
                    }}
                  >
                    Try again
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={() => setError(null)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="flex shrink-0 justify-between gap-2 border-t border-border/50 bg-card/40 px-6 py-4 sm:justify-between">
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled={isBusy}
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
                className="rounded-xl"
                onClick={handleNext}
                disabled={
                  isBusy ||
                  (mode === 'single'
                    ? !selectedPage
                    : step === 1
                      ? selectedPages.length === 0
                      : selectedPages.some(
                          (page) => !(bulkSourceConfig[page.id]?.sourceUsername || '').trim(),
                        ))
                }
              >
                Next
              </Button>
            ) : (
              <Button type="submit" loading={isPending} className="rounded-xl">
                {mode === 'single' ? 'Start Automation' : 'Create Selected Pages'}
              </Button>
            )}
          </DialogFooter>
        </form>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
