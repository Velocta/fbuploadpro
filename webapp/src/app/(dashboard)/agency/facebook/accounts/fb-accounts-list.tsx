'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Facebook,
  Trash2,
  Calendar,
  User,
  RefreshCw,
  Search,
  Settings2,
  Loader2,
  Building2,
} from 'lucide-react'
import { format } from 'date-fns'
import Image from 'next/image'
import { toast } from 'sonner'
import { AddFacebookAccountDialog } from './add-fb-account-dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AgencyEmptyState, AgencyInlineStatus, AgencyGlassPageHero } from '@/components/dashboard/agency'
import { fbAccountStatusLabel } from '@/lib/fb-account-status-labels'
import type { FacebookAccountWithPageStats } from '@/server/services/agency/facebook-accounts'
import { cn } from '@/lib/utils'

const ACCOUNTS_PAGE_SIZE = 9

type StatusFilter = 'all' | 'active' | 'invalid_token'

function AccountsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats Skeleton */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl border border-border/50 bg-card/40 p-5 animate-pulse flex flex-col justify-between">
            <div className="h-4 w-24 bg-muted/20 rounded" />
            <div className="h-6 w-16 bg-muted/20 rounded" />
          </div>
        ))}
      </div>

      {/* Accounts List Skeleton */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[200px] rounded-2xl border border-border/50 bg-card/40 p-5 animate-pulse flex flex-col justify-between">
            <div className="flex gap-3">
              <div className="h-12 w-12 bg-muted/20 rounded-full" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-32 bg-muted/20 rounded" />
                <div className="h-3 w-20 bg-muted/20 rounded" />
              </div>
            </div>
            <div className="h-10 bg-muted/20 rounded-lg w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function FacebookAccountsList() {
  const [accounts, setAccounts] = useState<FacebookAccountWithPageStats[]>([])
  const [summary, setSummary] = useState<{ total: number; active: number; invalidToken: number }>({ total: 0, active: 0, invalidToken: 0 })
  const [hasFacebookApp, setHasFacebookApp] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [accountsRes, settingsRes] = await Promise.all([
        fetch('/api/v1/agency/facebook/accounts'),
        fetch('/api/v1/agency/settings/facebook-app')
      ])

      if (accountsRes.ok && settingsRes.ok) {
        const accountsData = await accountsRes.json()
        const settingsData = await settingsRes.json()

        setAccounts(accountsData.accounts || [])
        setSummary(accountsData.summary || { total: 0, active: 0, invalidToken: 0 })
        setHasFacebookApp(settingsData.hasFacebookApp ?? false)
      } else {
        toast.error('Failed to load accounts data')
      }
    } catch {
      toast.error('An error occurred while loading data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
  }, [loadData])

  const [isPageChanging, setIsPageChanging] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const initialSearch = searchParams.get('q') || ''
  const initialStatusFilter = (searchParams.get('status') as StatusFilter) || 'all'
  const pageParam = searchParams.get('page')
  const initialPage = pageParam ? parseInt(pageParam, 10) || 1 : 1

  // Client-side local states for instantaneous responsiveness
  const [search, setSearch] = useState(initialSearch)
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter)
  const [page, setPage] = useState(initialPage)

  const [searchInput, setSearchInput] = useState(initialSearch)

  const lastPersistedSearchRef = useRef(initialSearch)
  const lastPersistedStatusRef = useRef(initialStatusFilter)
  const paginationLockRef = useRef(false)

  // Sync state if URL changes externally
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearch(initialSearch)
    setSearchInput(initialSearch)
    lastPersistedSearchRef.current = initialSearch
  }, [initialSearch])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatusFilter(initialStatusFilter)
    lastPersistedStatusRef.current = initialStatusFilter
  }, [initialStatusFilter])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(initialPage)
  }, [initialPage])

  const updateFiltersUrl = (updates: { q?: string | null; status?: string | null; page?: number | null }) => {
    const params = new URLSearchParams(window.location.search)
    if ('q' in updates) {
      const qVal = updates.q?.trim()
      if (qVal) params.set('q', qVal)
      else params.delete('q')
      params.delete('page')
      lastPersistedSearchRef.current = qVal || ''
    }
    if ('status' in updates) {
      if (updates.status && updates.status !== 'all') params.set('status', updates.status)
      else params.delete('status')
      params.delete('page')
      lastPersistedStatusRef.current = (updates.status as StatusFilter) || 'all'
    }
    if ('page' in updates) {
      if (updates.page && updates.page > 1) params.set('page', String(updates.page))
      else params.delete('page')
    }
    const newUrl = `${pathname}?${params.toString()}`
    window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, '', newUrl)
  }

  // Debounce URL updates for search queries to keep typing fluid
  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== lastPersistedSearchRef.current) {
        updateFiltersUrl({ q: search, page: 1 })
      }
    }, 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const filteredAccounts = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return accounts.filter((account) => {
      const matchesSearch =
        !needle ||
        account.fb_user_name?.toLowerCase().includes(needle) ||
        account.fb_user_id?.toLowerCase().includes(needle)
      const matchesStatus =
        statusFilter === 'all' || account.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [accounts, search, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / ACCOUNTS_PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginatedAccounts = filteredAccounts.slice(
    (currentPage - 1) * ACCOUNTS_PAGE_SIZE,
    currentPage * ACCOUNTS_PAGE_SIZE,
  )

  const handlePageChange = (newPage: number) => {
    if (paginationLockRef.current) return
    paginationLockRef.current = true
    setIsPageChanging(true)

    setPage(newPage)
    updateFiltersUrl({ page: newPage })

    setTimeout(() => {
      setIsPageChanging(false)
      paginationLockRef.current = false
    }, 250)
  }

  const handleDelete = async (id: string, accountName: string) => {
    if (deletingId) return
    setDeletingId(id)
    try {
      const result = await fetch(`/api/v1/agency/facebook/accounts/${id}`, { method: 'DELETE' })
      const payload = await result.json().catch(() => null)
      if (!result.ok) {
        toast.error('Failed to disconnect account', {
          description: payload?.error || 'Unknown error',
        })
      } else {
        toast.success('Account disconnected', {
          description: `${accountName} has been disconnected successfully.`,
        })
        void loadData()
      }
    } catch {
      toast.error('An unexpected error occurred while disconnecting')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <AgencyGlassPageHero
        segments={[
          { label: 'Agency', href: '/agency' },
          { label: 'FB Accounts' },
        ]}
        icon={<Building2 className="h-7 w-7 text-primary" />}
        title="Facebook accounts"
        description={
          hasFacebookApp === null
            ? 'Loading settings...'
            : hasFacebookApp
            ? 'Manage connected Facebook accounts, token health, and reconnect when needed.'
            : 'Connect your Facebook app in Settings before linking accounts.'
        }
        actions={
          hasFacebookApp === null ? null : hasFacebookApp ? (
            <AddFacebookAccountDialog />
          ) : (
            <Button asChild className="rounded-xl">
              <Link href="/agency/settings/facebook-byoc">
                <Settings2 className="mr-2 h-4 w-4" />
                Connect app in Settings
              </Link>
            </Button>
          )
        }
        tutorialHref="https://youtu.be/eVeDw8gKdE4"
      />

      {loading || hasFacebookApp === null ? (
        <AccountsSkeleton />
      ) : !hasFacebookApp ? (
        <AgencyEmptyState
          icon={<Settings2 className="h-7 w-7" />}
          title="Connect your Facebook app"
          description="Add your Facebook App ID and App Secret in Settings before you can connect accounts."
          actionHref={{
            label: 'Connect app in Settings',
            href: '/agency/settings/facebook-byoc',
          }}
        />
      ) : accounts.length === 0 ? (
        <AgencyEmptyState
          icon={<Facebook className="h-7 w-7" />}
          title="No accounts connected"
          description="Connect your Facebook account to start managing and automating your pages."
        />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-6 pb-8"
        >
          <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/40 px-5 py-4 shadow-lg backdrop-blur-xl">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{summary.total}</span> connected
              {' · '}
              <span className="text-primary">{summary.active} active</span>
              {summary.invalidToken > 0 ? (
                <>
                  {' · '}
                  <span className="text-destructive">{summary.invalidToken} need reconnect</span>
                </>
              ) : null}
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.05 }}
            className="relative group"
          >
            <div
              className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 to-blue-500/20 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100"
              aria-hidden
            />
            <div className="relative rounded-2xl border border-border/50 bg-card/40 p-5 shadow-2xl backdrop-blur-xl">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Facebook className="h-5 w-5 text-primary" />
                  <div>
                    <h2 className="text-lg font-semibold">Connected Accounts</h2>
                    <p className="text-sm text-muted-foreground">
                      {filteredAccounts.length}{' '}
                      {filteredAccounts.length === 1 ? 'account' : 'accounts'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="h-12 rounded-xl border-border/50 bg-background/50 pl-11"
                    placeholder="Search accounts by name or ID..."
                    value={searchInput}
                    onChange={(e) => {
                      const val = e.target.value
                      setSearchInput(val)
                      setSearch(val)
                      setPage(1)
                    }}
                  />
                </div>
                <Select
                  value={statusFilter}
                  onValueChange={(v: StatusFilter) => {
                    setStatusFilter(v)
                    setPage(1)
                    updateFiltersUrl({ status: v, page: 1 })
                  }}
                >
                  <SelectTrigger className="h-12 w-full rounded-xl border-border/50 bg-background/50 sm:w-44">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="invalid_token">Invalid token</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </motion.div>

          {filteredAccounts.length === 0 ? (
            <div className="rounded-3xl border border-dashed bg-muted/10 py-20 text-center">
              <p className="text-muted-foreground">No accounts match your filters.</p>
            </div>
          ) : (
            <>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {paginatedAccounts.map((account, index) => {
                  const statusDisplay = fbAccountStatusLabel(account.status)
                  const needsReconnect = account.status === 'invalid_token'

                  return (
                    <motion.div
                      key={account.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.04 }}
                      className="group relative"
                    >
                      <div
                        className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 to-blue-500/20 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100"
                        aria-hidden
                      />
                      <div
                        className={cn(
                          'relative flex h-full flex-col rounded-2xl border bg-card/40 p-5 shadow-2xl backdrop-blur-xl transition-all hover:border-primary/30',
                          needsReconnect
                            ? 'border-destructive/35 ring-1 ring-destructive/15'
                            : 'border-border/50',
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-4">
                            {account.fb_user_image ? (
                              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full shadow-sm ring-2 ring-transparent transition-all group-hover:ring-primary/20">
                                <Image
                                  src={account.fb_user_image}
                                  alt={account.fb_user_name || 'Facebook user image'}
                                  fill
                                  sizes="48px"
                                  className="object-cover"
                                  unoptimized
                                  priority={index < 3}
                                />
                              </div>
                            ) : (
                              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted ring-2 ring-transparent transition-all group-hover:ring-primary/20">
                                <User className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-lg font-semibold">{account.fb_user_name}</p>
                              <p className="mt-0.5 truncate font-mono text-sm text-muted-foreground">
                                {account.fb_user_id}
                              </p>
                            </div>
                          </div>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 shrink-0 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                disabled={deletingId !== null}
                                title="Disconnect account"
                              >
                                {deletingId === account.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-2xl border-border/50 bg-card/95 backdrop-blur-xl">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="font-display">
                                  Disconnect Facebook Account?
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-muted-foreground">
                                  Are you sure you want to disconnect{' '}
                                  <strong>{account.fb_user_name}</strong>? All associated pages will
                                  also be removed. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="h-11 rounded-xl px-6 font-bold">
                                  Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    handleDelete(account.id, account.fb_user_name || 'this account')
                                  }
                                  className="h-11 rounded-xl bg-destructive px-6 font-bold text-destructive-foreground hover:bg-destructive/90"
                                  disabled={deletingId !== null}
                                >
                                  {deletingId === account.id ? 'Disconnecting...' : 'Disconnect'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <AgencyInlineStatus
                            label={statusDisplay.label}
                            tone={statusDisplay.tone}
                          />
                        </div>

                        {account.linkedPagesCount > 0 ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            {account.linkedPagesCount} ADU connected page
                            {account.linkedPagesCount === 1 ? '' : 's'}
                            {account.invalidTokenPagesCount > 0
                              ? ` · ${account.invalidTokenPagesCount} with invalid token`
                              : ''}
                          </p>
                        ) : (
                          <p className="mt-2 text-xs text-muted-foreground">0 ADU connected pages</p>
                        )}

                        {needsReconnect ? (
                          <p className="mt-2 text-xs font-medium text-destructive">
                            Token expired — reconnect to restore linked pages.
                          </p>
                        ) : null}

                        <div className="mt-4 border-t border-border/50 pt-4">
                          <div className="flex items-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            <Calendar className="mr-2 h-3.5 w-3.5 text-primary/50" />
                            Connected{' '}
                            {format(new Date(account.created_at ?? new Date()), 'MMM dd, yyyy')}
                          </div>
                        </div>

                        <div className="mt-4">
                          <AddFacebookAccountDialog>
                            <Button
                              variant={needsReconnect ? 'default' : 'outline'}
                              size="sm"
                              className={cn(
                                'w-full rounded-full',
                                needsReconnect && 'bg-destructive hover:bg-destructive/90',
                              )}
                              disabled={deletingId !== null}
                            >
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Reconnect
                            </Button>
                          </AddFacebookAccountDialog>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>

              {filteredAccounts.length > ACCOUNTS_PAGE_SIZE && (
                <div className="flex items-center justify-center gap-4 py-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => {
                      const newPage = Math.max(1, currentPage - 1)
                      handlePageChange(newPage)
                    }}
                    disabled={currentPage === 1 || isPageChanging}
                  >
                    {isPageChanging && <Loader2 className="mr-2 h-4 w-4 animate-spin text-muted-foreground" />}
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => {
                      const newPage = Math.min(totalPages, currentPage + 1)
                      handlePageChange(newPage)
                    }}
                    disabled={currentPage >= totalPages || isPageChanging}
                  >
                    {isPageChanging && <Loader2 className="mr-2 h-4 w-4 animate-spin text-muted-foreground" />}
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </motion.div>
      )}
    </div>
  )
}
