'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Facebook, Search, Loader2, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { TimezoneSelect } from '@/components/dashboard/timezone-select'
import { PostsPerDayPicker } from '@/components/dashboard/posts-per-day-picker'
import { TimeSlotInput } from '@/components/dashboard/time-slot-input'

type FacebookAccount = { id: string; fb_user_id: string; fb_user_name: string; fb_user_image: string | null }
type FacebookGraphPage = { id: string; name: string; access_token: string; picture?: string; followers_count?: number }

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

export function AddInappPageDialog({ agencyId }: { agencyId: string }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (!agencyId) {
    // No-op
  }
  const [fbAccounts, setFbAccounts] = useState<FacebookAccount[]>([])
  const [accountSearch, setAccountSearch] = useState('')
  const [pageSearch, setPageSearch] = useState('')
  
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [fbPages, setFbPages] = useState<FacebookGraphPage[]>([])
  
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false)
  const [isLoadingPages, setIsLoadingPages] = useState(false)
  
  const [selectedPage, setSelectedPage] = useState<FacebookGraphPage | null>(null)

  // Scheduling defaults inside Add Page flow
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
  const [postsPerDay, setPostsPerDay] = useState('2')
  const [postingTimes, setPostingTimes] = useState<string[]>(['09:00 AM', '03:00 PM'])

  const router = useRouter()

  const loadAccounts = useCallback(async () => {
    setIsLoadingAccounts(true)
    try {
      const res = await fetch('/api/v1/agency/facebook/accounts')
      const result = await res.json()
      if (res.ok && result.accounts) {
        setFbAccounts(result.accounts)
      } else {
        toast.error('Failed to load accounts', { description: result.error || 'Unknown error' })
      }
    } catch {
      toast.error('Failed to load accounts')
    } finally {
      setIsLoadingAccounts(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => {
        void loadAccounts()
      }, 0)
      return () => clearTimeout(t)
    }
  }, [open, loadAccounts])

  async function handleAccountChange(accountId: string) {
    setSelectedAccountId(accountId)
    setSelectedPage(null)
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
        setError(result.error || 'Failed to fetch pages')
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsLoadingPages(false)
    }
  }

  function resetDialogState() {
    setOpen(false)
    setStep(1)
    setError(null)
    setSelectedAccountId('')
    setSelectedPage(null)
    setFbPages([])
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
    setPostsPerDay('2')
    setPostingTimes(['09:00 AM', '03:00 PM'])
  }

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (step === 1) {
      if (selectedPage && selectedAccountId) {
        setStep(2)
        setError(null)
      } else {
        setError('Please select a Facebook account and page.')
      }
      return
    }

    if (!selectedPage || !selectedAccountId) {
      setError('Please select a Facebook page.')
      return
    }

    if (postingTimes.some(t => !t)) {
      setError('Please configure all posting slot times.')
      return
    }

    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/v1/agency/facebook/inapp-schedule/pages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            facebookAccountId: selectedAccountId,
            fbPageId: selectedPage.id,
            fbPageName: selectedPage.name,
            fbPageImage: selectedPage.picture,
            fbPageAccessToken: selectedPage.access_token,
            followersCount: selectedPage.followers_count,
            postsPerDay: Number(postsPerDay),
            postingTimes: postingTimes,
            scheduleTimezone: timezone,
          }),
        })

        if (!res.ok) {
          const result = await res.json()
          setError(result.error || 'Failed to add page')
          return
        }

        toast.success('Page added', {
          description: `${selectedPage.name} is now available for inapp scheduling.`,
        })
        resetDialogState()
        router.refresh()
      } catch {
        setError('Failed to add page due to a network error.')
      }
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
                <DialogTitle className="font-display text-xl">
                  {step === 1 ? 'Add Scheduling Page' : 'Configure Posting Schedule'}
                </DialogTitle>
                <DialogDescription className="mt-1 text-muted-foreground">
                  {step === 1 
                    ? 'Step 1 of 2: Select a Facebook page to enable InApp scheduling.'
                    : 'Step 2 of 2: Configure posting slots and timezone.'
                  }
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {step === 1 ? (
                <div className="rounded-2xl border border-border/50 bg-card/40 p-5 backdrop-blur-sm space-y-5">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">Select Facebook Account</Label>
                    </div>

                    {isLoadingAccounts ? (
                      <LoadingPanel message="Loading accounts…" />
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
                    <div className="space-y-3 mt-6">
                      <Label className="text-sm font-semibold">Select Page</Label>
                      {isLoadingPages ? (
                        <LoadingPanel message="Loading pages…" />
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
                            {filteredPages.map((page) => (
                              <button
                                key={page.id}
                                type="button"
                                onClick={() => setSelectedPage(page)}
                                className={cn(
                                  'group flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all',
                                  selectedPage?.id === page.id
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
                                    {page.id}
                                  </p>
                                </div>
                                <div
                                  className={cn(
                                    'flex h-5 w-5 items-center justify-center rounded-full border transition-all',
                                    selectedPage?.id === page.id
                                      ? 'border-primary bg-primary text-primary-foreground'
                                      : 'border-input group-hover:border-primary/50',
                                  )}
                                >
                                  {selectedPage?.id === page.id && (
                                    <motion.div
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      className="h-2 w-2 rounded-full bg-current"
                                    />
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-border/50 bg-card/40 p-5 backdrop-blur-sm space-y-6 animate-in fade-in duration-300">
                  {/* Selected Page Header Card */}
                  <div className="flex items-center gap-4 border-b border-border/40 pb-4">
                    {selectedPage?.picture ? (
                      <Image
                        src={selectedPage.picture}
                        alt={selectedPage.name}
                        width={48}
                        height={48}
                        className="rounded-lg object-cover ring-2 ring-primary/20"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                        <Facebook className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-foreground">{selectedPage?.name}</h4>
                      <p className="font-mono text-xs text-muted-foreground">Page ID: {selectedPage?.id}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <h4 className="text-sm font-bold">Default Queue Configuration</h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Posting Timezone</Label>
                      <TimezoneSelect value={timezone} onValueChange={setTimezone} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Posts Per Day</Label>
                      <PostsPerDayPicker
                        value={Number(postsPerDay)}
                        onValueChange={(v) => {
                          setPostsPerDay(v)
                          const count = Number(v)
                          const newTimes = [...postingTimes]
                          if (count > newTimes.length) {
                            for (let i = newTimes.length; i < count; i++) {
                              newTimes.push(i === 0 ? "09:00 AM" : i === 1 ? "03:00 PM" : "")
                            }
                          } else if (count < newTimes.length) {
                            newTimes.splice(count)
                          }
                          setPostingTimes(newTimes)
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs font-bold uppercase tracking-wider">Configure Slots ({postingTimes.length})</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {postingTimes.map((time, index) => (
                        <div key={index} className="flex items-center gap-2 group">
                          <div className="flex-1">
                            <TimeSlotInput
                              idPrefix={`add-page-inapp-slot-${index}`}
                              value={time || ''}
                              onChange={(v) => {
                                const newTimes = [...postingTimes]
                                newTimes[index] = v
                                setPostingTimes(newTimes)
                              }}
                              nextFieldId={
                                index < postingTimes.length - 1
                                  ? `add-page-inapp-slot-${index + 1}-field`
                                  : undefined
                              }
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="px-6 py-2">
                <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              </div>
            )}

            <div className="border-t border-border/50 bg-muted/20 px-6 py-4">
              <div className="flex items-center justify-between gap-3">
                {step === 2 ? (
                  <Button
                    key="btn-back"
                    type="button"
                    variant="ghost"
                    onClick={() => setStep(1)}
                    disabled={isPending}
                  >
                    Back
                  </Button>
                ) : (
                  <Button
                    key="btn-cancel"
                    type="button"
                    variant="ghost"
                    onClick={resetDialogState}
                  >
                    Cancel
                  </Button>
                )}

                {step === 1 ? (
                  <Button
                    key="btn-next"
                    type="button"
                    disabled={!selectedPage}
                    onClick={() => setStep(2)}
                    className="rounded-xl bg-primary px-8"
                  >
                    Next: Configure Slots
                  </Button>
                ) : (
                  <Button
                    key="btn-submit"
                    type="button"
                    disabled={!selectedPage || isPending}
                    onClick={() => handleSubmit()}
                    className="rounded-xl bg-primary px-8"
                    loading={isPending}
                  >
                    Add Page
                  </Button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
