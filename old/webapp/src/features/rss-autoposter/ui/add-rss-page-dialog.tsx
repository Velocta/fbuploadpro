'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Plus,
  Loader2,
  ArrowRight,
  Facebook,
  Rss,
  Search,
  Check,
  Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TimezoneSelect } from '@/components/dashboard/timezone-select'
import { PostsPerDayPicker } from '@/components/dashboard/posts-per-day-picker'
import { TimeSlotInput } from '@/components/dashboard/time-slot-input'
import { HubActionPendingOverlay } from '@/components/dashboard/hub-action-pending-overlay'
import { AgencyEmptyState } from '@/components/dashboard/agency'
import { generateBalancedPostTimes } from '@/lib/scheduling'
import { RSS_TEMPLATE_PRESETS } from '@/lib/rss-autoposter/presets'
import type { CanvasAspectRatio, RssTemplateDefinition } from '@/contracts/rss-autoposter'
import { cn } from '@/lib/utils'
import { TemplateBuilder } from './template-builder'
import {
  RSS_WIZARD_TOTAL_STEPS,
  WizardGlassPanel,
  WizardInlineError,
  WizardLoadingPanel,
  WizardStepProgress,
  rssWizardStepSubtitle,
} from './rss-wizard-shell'

type FacebookAccount = {
  id: string
  fb_user_id: string
  fb_user_name: string
  fb_user_image: string | null
}

type FacebookGraphPage = {
  id: string
  name: string
  access_token: string
  picture?: string
}

const DEFAULT_DEFINITION =
  RSS_TEMPLATE_PRESETS['breaking-banner']?.definition ??
  RSS_TEMPLATE_PRESETS['highlight-headline']!.definition

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value.trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export function AddRssPageDialog({ agencyId }: { agencyId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (!agencyId) {
    // No-op to satisfy unused variable check without breaking hooks order
  }
  const [feedError, setFeedError] = useState<string | null>(null)
  const submittingRef = useRef(false)
  const pagesFetchGeneration = useRef(0)
  const pagesAbortRef = useRef<AbortController | null>(null)

  const [fbAccounts, setFbAccounts] = useState<FacebookAccount[]>([])
  const [hasLoadedAccounts, setHasLoadedAccounts] = useState(false)
  const [accountSearch, setAccountSearch] = useState('')
  const [pageSearch, setPageSearch] = useState('')
  const [selectedAccount, setSelectedAccount] = useState<FacebookAccount | null>(null)
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [fbPages, setFbPages] = useState<FacebookGraphPage[]>([])
  const [selectedPage, setSelectedPage] = useState<FacebookGraphPage | null>(null)
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false)
  const [isLoadingPages, setIsLoadingPages] = useState(false)

  const [rssFeedUrl, setRssFeedUrl] = useState('')
  const [feedValidatedUrl, setFeedValidatedUrl] = useState('')
  const [feedPreview, setFeedPreview] = useState<{
    feedTitle: string
    latest: { title: string; description: string; imageUrl: string | null }
  } | null>(null)
  const [validatingFeed, setValidatingFeed] = useState(false)

  const [timezone, setTimezone] = useState('Asia/Karachi')
  const [postsPerDay, setPostsPerDay] = useState('1')
  const [scheduleType, setScheduleType] = useState<'dailyrandom' | 'fixed' | 'randomfixed'>('dailyrandom')
  const [postingTimes, setPostingTimes] = useState<string[]>(['09:00'])

  const [canvasAspectRatio, setCanvasAspectRatio] = useState<CanvasAspectRatio>('4:5')
  const [templateDefinition, setTemplateDefinition] = useState<RssTemplateDefinition>(DEFAULT_DEFINITION)
  const [templatePresetKey, setTemplatePresetKey] = useState('breaking-banner')
  const [firstComment, setFirstComment] = useState('')
  const [brandSiteUrl, setBrandSiteUrl] = useState('')

  const isBusy = isPending || isLoadingAccounts || isLoadingPages || validatingFeed

  const filteredAccounts = useMemo(
    () =>
      fbAccounts.filter((acc) =>
        (acc.fb_user_name || '').toLowerCase().includes(accountSearch.toLowerCase()),
      ),
    [fbAccounts, accountSearch],
  )

  const filteredPages = useMemo(
    () => fbPages.filter((page) => page.name.toLowerCase().includes(pageSearch.toLowerCase())),
    [fbPages, pageSearch],
  )

  useEffect(() => {
    if (open) loadAccounts()
  }, [open])

  useEffect(() => {
    const count = parseInt(postsPerDay, 10)
    const t = setTimeout(() => {
      if (scheduleType === 'fixed') {
        setPostingTimes((prev) => {
          const next = [...prev]
          while (next.length < count) next.push('')
          return next.slice(0, count)
        })
      } else if (scheduleType === 'dailyrandom' || scheduleType === 'randomfixed') {
        setPostingTimes(generateBalancedPostTimes(count))
      }
    }, 0)
    return () => clearTimeout(t)
  }, [postsPerDay, scheduleType])

  async function loadAccounts() {
    setIsLoadingAccounts(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/agency/facebook/accounts')
      const data = await res.json()
      if (!res.ok) {
        const msg = data.error || 'Failed to load accounts'
        setError(msg)
        toast.error('Failed to load accounts', { description: msg })
        setFbAccounts([])
        return
      }
      setFbAccounts(data.accounts || [])
    } catch {
      const msg = 'An unexpected error occurred while loading accounts'
      setError(msg)
      toast.error('Failed to load accounts', { description: msg })
      setFbAccounts([])
    } finally {
      setIsLoadingAccounts(false)
      setHasLoadedAccounts(true)
    }
  }

  async function handleSelectAccount(account: FacebookAccount) {
    pagesAbortRef.current?.abort()
    const generation = ++pagesFetchGeneration.current
    setSelectedAccount(account)
    setSelectedAccountId(account.id)
    setSelectedPage(null)
    setPageSearch('')
    setFbPages([])
    setError(null)

    const controller = new AbortController()
    pagesAbortRef.current = controller
    setIsLoadingPages(true)

    try {
      const res = await fetch(`/api/v1/agency/facebook/accounts/${account.id}/pages`, {
        signal: controller.signal,
      })
      if (generation !== pagesFetchGeneration.current) return
      const data = await res.json()
      if (!res.ok) {
        const msg = data.error || 'Failed to fetch pages'
        setError(msg)
        toast.error('Failed to fetch pages', { description: msg })
        return
      }
      setFbPages(data.pages || [])
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      if (generation !== pagesFetchGeneration.current) return
      const msg = 'An unexpected error occurred while fetching pages'
      setError(msg)
      toast.error('Error', { description: msg })
    } finally {
      if (generation === pagesFetchGeneration.current) {
        setIsLoadingPages(false)
      }
    }
  }

  function handleRssUrlChange(value: string) {
    setRssFeedUrl(value)
    if (feedPreview && value.trim() !== feedValidatedUrl) {
      setFeedPreview(null)
      setFeedValidatedUrl('')
      setFeedError(null)
    }
  }

  async function validateFeed() {
    const trimmed = rssFeedUrl.trim()
    if (!isValidHttpUrl(trimmed)) {
      setFeedError('Enter a valid http(s) RSS feed URL')
      return
    }
    setValidatingFeed(true)
    setFeedPreview(null)
    setFeedError(null)
    try {
      const res = await fetch('/api/v1/agency/facebook/rss-autoposter/validate-feed', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rssFeedUrl: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Invalid feed')
      setFeedPreview({ feedTitle: data.feedTitle, latest: data.latest })
      setFeedValidatedUrl(trimmed)
      toast.success('RSS feed validated')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Feed validation failed'
      setFeedError(msg)
      toast.error(msg)
    } finally {
      setValidatingFeed(false)
    }
  }

  function resetWizard(force = false) {
    if (!force && isBusy) return
    pagesAbortRef.current?.abort()
    pagesAbortRef.current = null
    setStep(1)
    setError(null)
    setFeedError(null)
    setAccountSearch('')
    setPageSearch('')
    setSelectedAccount(null)
    setSelectedAccountId('')
    setSelectedPage(null)
    setFbPages([])
    setRssFeedUrl('')
    setFeedValidatedUrl('')
    setFeedPreview(null)
    setTimezone('Asia/Karachi')
    setPostsPerDay('1')
    setScheduleType('dailyrandom')
    setPostingTimes(['09:00'])
    setTemplateDefinition(DEFAULT_DEFINITION)
    setTemplatePresetKey('breaking-banner')
    setFirstComment('')
    setBrandSiteUrl('')
    setCanvasAspectRatio('4:5')
  }

  function handleDialogOpenChange(nextOpen: boolean) {
    if (!nextOpen && isBusy) {
      toast.warning('Please wait', {
        description: 'Finish loading or saving before closing.',
      })
      return
    }
    if (nextOpen) setOpen(true)
    else {
      setOpen(false)
      resetWizard(true)
    }
  }

  function submit() {
    if (submittingRef.current || isPending) return
    if (!selectedPage || !selectedAccountId || !feedPreview) {
      toast.error('Complete all steps')
      return
    }
    submittingRef.current = true
    startTransition(async () => {
      try {
        const res = await fetch('/api/v1/agency/facebook/rss-autoposter/pages', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            facebookAccountId: selectedAccountId,
            fbPageId: selectedPage.id,
            fbPageName: selectedPage.name,
            fbPageAccessToken: selectedPage.access_token,
            fbPageImage: selectedPage.picture,
            rssFeedUrl: rssFeedUrl.trim(),
            timezone,
            postsPerDay: parseInt(postsPerDay, 10),
            scheduleType,
            postingTimes,
            templateDefinition,
            templatePresetKey,
            canvasAspectRatio,
            firstComment: firstComment || undefined,
            brandSiteUrl: brandSiteUrl.trim() || undefined,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to create page')
        toast.success('RSS Auto Poster page connected', {
          description: `${selectedPage.name} will start posting on schedule.`,
        })
        setOpen(false)
        resetWizard(true)
        router.refresh()
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to connect page'
        setError(msg)
        toast.error(msg)
      } finally {
        submittingRef.current = false
      }
    })
  }

  const fixedTimesIncomplete =
    scheduleType === 'fixed' && postingTimes.some((t) => !t)

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogTrigger asChild>
        <Button className="group relative h-11 overflow-hidden rounded-xl bg-primary px-6 text-primary-foreground shadow-[0_0_28px_-8px_hsl(var(--primary)/0.55)] ring-1 ring-primary/25 transition-all hover:bg-primary/90 hover:shadow-[0_0_36px_-6px_hsl(var(--primary)/0.65)]">
          <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/15 to-white/0 opacity-0 transition-opacity group-hover:opacity-100" />
          <span className="relative flex items-center">
            <Plus className="mr-2 h-4 w-4" />
            Connect Page
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] w-full max-w-[95vw] flex-col overflow-hidden border-0 bg-transparent p-0 shadow-none sm:max-w-4xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="relative flex max-h-[90vh] flex-col overflow-hidden rounded-3xl border border-border/50 bg-card/95 shadow-2xl backdrop-blur-xl"
        >
          <DialogHeader className="space-y-4 border-b border-border/50 px-6 py-5 text-left">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                <Rss className="h-7 w-7 text-primary" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="font-display text-xl">Connect RSS Auto Poster</DialogTitle>
                <DialogDescription className="mt-1 text-muted-foreground">
                  Step {step} of {RSS_WIZARD_TOTAL_STEPS}: {rssWizardStepSubtitle(step)}
                </DialogDescription>
              </div>
            </div>
            <WizardStepProgress step={step} />
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {error && step === 1 ? (
              <div className="mb-4">
                <WizardInlineError message={error} onDismiss={() => setError(null)} onRetry={loadAccounts} />
              </div>
            ) : null}

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {step === 1 && (
                  <>
                    {!hasLoadedAccounts || isLoadingAccounts ? (
                      <WizardLoadingPanel message="Loading Facebook accounts…" />
                    ) : fbAccounts.length === 0 ? (
                      <AgencyEmptyState
                        icon={<Facebook className="h-6 w-6" />}
                        title="No Facebook accounts"
                        description="Connect a Facebook account before adding an RSS page."
                        actionHref={{ label: 'Go to FB Accounts', href: '/agency/facebook/accounts' }}
                      />
                    ) : !selectedAccount ? (
                      <div className="relative group">
                        <div
                          className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 to-blue-500/20 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100"
                          aria-hidden
                        />
                        <div className="relative rounded-2xl border border-border/50 bg-card/40 p-6 shadow-2xl backdrop-blur-xl">
                          <div className="mb-4 flex items-center gap-3">
                            <Facebook className="h-5 w-5 text-blue-500" />
                            <h3 className="text-lg font-semibold">Select account</h3>
                          </div>
                          <div className="relative mb-4">
                            <Search className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              className="h-12 rounded-xl border-border/50 bg-background/50 pl-11"
                              placeholder="Search accounts…"
                              value={accountSearch}
                              onChange={(e) => setAccountSearch(e.target.value)}
                            />
                          </div>
                          <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
                            {filteredAccounts.length === 0 ? (
                              <p className="py-8 text-center text-sm text-muted-foreground">
                                No accounts match your search
                              </p>
                            ) : (
                              filteredAccounts.map((acc) => (
                                <button
                                  key={acc.id}
                                  type="button"
                                  onClick={() => handleSelectAccount(acc)}
                                  className="flex w-full items-center gap-4 rounded-xl border border-transparent p-4 text-left transition-all hover:border-border hover:bg-muted/30"
                                >
                                  {acc.fb_user_image ? (
                                    <Image
                                      src={acc.fb_user_image}
                                      alt=""
                                      width={48}
                                      height={48}
                                      className="rounded-full"
                                      unoptimized
                                    />
                                  ) : (
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                                      <Facebook className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="font-semibold">{acc.fb_user_name}</p>
                                    <p className="text-xs font-mono text-muted-foreground">{acc.fb_user_id}</p>
                                  </div>
                                  <ArrowRight className="h-4 w-4 shrink-0 text-primary opacity-60" />
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="relative group">
                        <div
                          className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 to-blue-500/20 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100"
                          aria-hidden
                        />
                        <div className="relative rounded-2xl border border-border/50 bg-card/40 p-6 shadow-2xl backdrop-blur-xl">
                          <HubActionPendingOverlay show={isLoadingPages} message="Loading pages…" />
                          <div className="mb-4 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <Layers className="h-5 w-5 text-primary" />
                              <h3 className="text-lg font-semibold">Select page</h3>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground"
                              onClick={() => {
                                setSelectedAccount(null)
                                setSelectedAccountId('')
                                setSelectedPage(null)
                                setFbPages([])
                              }}
                            >
                              Back
                            </Button>
                          </div>
                          <div className="relative mb-4">
                            <Search className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              className="h-12 rounded-xl border-border/50 bg-background/50 pl-11"
                              placeholder="Search pages…"
                              value={pageSearch}
                              onChange={(e) => setPageSearch(e.target.value)}
                            />
                          </div>
                          <div className="grid max-h-[360px] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                            {isLoadingPages ? (
                              <div className="col-span-full flex justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                              </div>
                            ) : fbPages.length === 0 ? (
                              <div className="col-span-full">
                                <AgencyEmptyState
                                  icon={<Layers className="h-6 w-6" />}
                                  title="No pages on this account"
                                  description="This Facebook account has no managed pages available."
                                />
                              </div>
                            ) : filteredPages.length === 0 ? (
                              <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
                                No pages match your search
                              </p>
                            ) : (
                              filteredPages.map((p) => {
                                const selected = selectedPage?.id === p.id
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => setSelectedPage(p)}
                                    className={cn(
                                      'relative flex flex-col items-start rounded-xl border p-4 text-left transition-all',
                                      selected
                                        ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
                                        : 'border-border/50 bg-background/30 hover:border-primary/40 hover:bg-muted/40',
                                    )}
                                  >
                                    {selected ? (
                                      <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                        <Check className="h-3.5 w-3.5" />
                                      </span>
                                    ) : null}
                                    {p.picture ? (
                                      <Image
                                        src={p.picture}
                                        alt=""
                                        width={40}
                                        height={40}
                                        className="mb-2 rounded-lg"
                                        unoptimized
                                      />
                                    ) : (
                                      <Facebook className="mb-2 h-8 w-8 text-primary" />
                                    )}
                                    <span className="line-clamp-2 text-sm font-semibold">{p.name}</span>
                                  </button>
                                )
                              })
                            )}
                          </div>
                          {selectedPage ? (
                            <Badge variant="outline" className="mt-4">
                              1 page selected
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {step === 2 && (
                  <WizardGlassPanel className="space-y-4">
                    <div>
                      <Label>RSS feed URL</Label>
                      <Input
                        value={rssFeedUrl}
                        onChange={(e) => handleRssUrlChange(e.target.value)}
                        placeholder="https://example.com/feed.xml"
                        className="mt-1.5 rounded-xl"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      className="rounded-xl"
                      onClick={validateFeed}
                      disabled={validatingFeed || !rssFeedUrl.trim()}
                    >
                      {validatingFeed ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Rss className="mr-2 h-4 w-4" />
                      )}
                      Validate feed
                    </Button>
                    {feedError ? <WizardInlineError message={feedError} onDismiss={() => setFeedError(null)} /> : null}
                    {validatingFeed ? (
                      <WizardLoadingPanel message="Checking feed…" submessage="Fetching latest item preview" />
                    ) : null}
                    {feedPreview && !validatingFeed ? (
                      <div className="rounded-xl border border-border/50 bg-background/40 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {feedPreview.feedTitle}
                        </p>
                        <p className="mt-2 font-medium">{feedPreview.latest.title}</p>
                        <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                          {feedPreview.latest.description}
                        </p>
                        {feedPreview.latest.imageUrl ? (
                          <div className="relative mt-3 h-24 w-full overflow-hidden rounded-lg">
                            <Image
                              src={feedPreview.latest.imageUrl}
                              alt=""
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </WizardGlassPanel>
                )}

                {step === 3 && (
                  <div className="space-y-6">
                    <WizardGlassPanel className="space-y-4">
                      <p className="text-sm font-semibold text-foreground">Posting schedule</p>
                      <TimezoneSelect value={timezone} onValueChange={setTimezone} />
                      <PostsPerDayPicker
                        value={parseInt(postsPerDay, 10) || 1}
                        onValueChange={setPostsPerDay}
                      />
                      <div>
                        <Label>Schedule type</Label>
                        <Select
                          value={scheduleType}
                          onValueChange={(v) => setScheduleType(v as typeof scheduleType)}
                        >
                          <SelectTrigger className="mt-1.5 rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dailyrandom">Daily random</SelectItem>
                            <SelectItem value="fixed">Fixed times</SelectItem>
                            <SelectItem value="randomfixed">Random fixed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {scheduleType === 'fixed' && (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {postingTimes.map((time, index) => (
                            <TimeSlotInput
                              key={`rss-time-${index}`}
                              idPrefix={`add-rss-time-${index}`}
                              value={time || ''}
                              onChange={(value) => {
                                setPostingTimes((prev) => {
                                  const next = [...prev]
                                  next[index] = value
                                  return next
                                })
                              }}
                            />
                          ))}
                        </div>
                      )}
                      {fixedTimesIncomplete ? (
                        <p className="text-sm text-destructive">Select a time for each post slot.</p>
                      ) : null}
                    </WizardGlassPanel>
                    <WizardGlassPanel className="space-y-4">
                      <p className="text-sm font-semibold text-foreground">Optional</p>
                      <div>
                        <Label>Brand site URL</Label>
                        <Input
                          value={brandSiteUrl}
                          onChange={(e) => setBrandSiteUrl(e.target.value)}
                          placeholder="https://yoursite.com"
                          className="mt-1.5 rounded-xl"
                        />
                      </div>
                      <div>
                        <Label>First comment</Label>
                        <Input
                          value={firstComment}
                          onChange={(e) => setFirstComment(e.target.value)}
                          placeholder="Posted via…"
                          className="mt-1.5 rounded-xl"
                        />
                      </div>
                    </WizardGlassPanel>
                  </div>
                )}

                {step === 4 && (
                  <WizardGlassPanel className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Choose a preset and customize layers. Preview uses your validated feed sample.
                    </p>
                    <TemplateBuilder
                      definition={templateDefinition}
                      onChange={(def) => {
                        setTemplateDefinition(def)
                        setTemplatePresetKey('custom')
                      }}
                      canvasAspectRatio={canvasAspectRatio}
                      onAspectRatioChange={setCanvasAspectRatio}
                      sampleTitle={feedPreview?.latest.title}
                      sampleDescription={feedPreview?.latest.description}
                      sampleImageUrl={feedPreview?.latest.imageUrl || undefined}
                      brandSiteUrl={brandSiteUrl}
                    />
                  </WizardGlassPanel>
                )}

                {step === 5 && selectedPage && (
                  <div className="rounded-2xl border border-border/50 bg-card/40 p-5 backdrop-blur-sm">
                    <div className="flex items-start gap-4">
                      {selectedPage.picture ? (
                        <Image
                          src={selectedPage.picture}
                          alt=""
                          width={56}
                          height={56}
                          className="rounded-xl"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                          <Facebook className="h-7 w-7 text-primary" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-display text-lg font-semibold">{selectedPage.name}</p>
                        <p className="truncate text-sm text-muted-foreground">{rssFeedUrl.trim()}</p>
                        <div className="flex flex-wrap gap-2 pt-2">
                          <Badge variant="secondary">
                            {postsPerDay}/day · {scheduleType}
                          </Badge>
                          <Badge variant="outline">{templatePresetKey}</Badge>
                          <Badge variant="outline">{canvasAspectRatio}</Badge>
                        </div>
                        <p className="pt-2 text-xs text-muted-foreground">
                          {timezone} · {postingTimes.filter(Boolean).length || postsPerDay} slot
                          {firstComment ? ` · First comment set` : ''}
                          {brandSiteUrl.trim() ? ` · Brand URL set` : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <DialogFooter className="gap-2 border-t border-border/50 px-6 py-4 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              disabled={step <= 1 || isBusy}
              onClick={() => setStep((s) => s - 1)}
            >
              Back
            </Button>
            {step < RSS_WIZARD_TOTAL_STEPS ? (
              <Button
                type="button"
                className="rounded-xl"
                onClick={() => setStep((s) => s + 1)}
                disabled={
                  isBusy ||
                  (step === 1 && !selectedPage) ||
                  (step === 2 && !feedPreview) ||
                  (step === 3 && fixedTimesIncomplete)
                }
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                className="rounded-xl"
                onClick={submit}
                loading={isPending}
                disabled={isBusy}
              >
                Connect & start
              </Button>
            )}
          </DialogFooter>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
