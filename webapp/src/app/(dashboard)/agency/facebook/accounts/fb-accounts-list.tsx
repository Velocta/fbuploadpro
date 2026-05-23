'use client'

import { useMemo, useState, useTransition } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Facebook, Trash2, Calendar, User, RefreshCw, Search } from 'lucide-react'
import { format } from 'date-fns'
import Image from 'next/image'
import { FacebookAccount } from '@/types/app.types'
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
import { AgencyEmptyState } from '@/components/dashboard/agency'

const ACCOUNTS_PAGE_SIZE = 9

export function FacebookAccountsList({ accounts }: { accounts: FacebookAccount[] }) {
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const filteredAccounts = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return accounts
    return accounts.filter(
      (account) =>
        account.fb_user_name?.toLowerCase().includes(needle) ||
        account.fb_user_id?.toLowerCase().includes(needle),
    )
  }, [accounts, search])

  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / ACCOUNTS_PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginatedAccounts = filteredAccounts.slice(
    (currentPage - 1) * ACCOUNTS_PAGE_SIZE,
    currentPage * ACCOUNTS_PAGE_SIZE,
  )

  const handleDelete = (id: string, accountName: string) => {
    startTransition(async () => {
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
        window.location.reload()
      }
    })
  }

  if (accounts.length === 0) {
    return (
      <AgencyEmptyState
        icon={<Facebook className="h-7 w-7" />}
        title="No accounts connected"
        description="Connect your Facebook account to start managing and automating your pages."
      />
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6 pb-8"
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.05 }}
        className="relative group"
      >
        <motion.div
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
          <div className="relative">
            <Search className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="h-12 rounded-xl border-border/50 bg-background/50 pl-11"
              placeholder="Search accounts by name or ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>
        </div>
      </motion.div>

      {filteredAccounts.length === 0 ? (
        <div className="rounded-3xl border border-dashed bg-muted/10 py-20 text-center">
          <p className="text-muted-foreground">No accounts match your search.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {paginatedAccounts.map((account, index) => (
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
                <div className="relative flex h-full flex-col rounded-2xl border border-border/50 bg-card/40 p-5 shadow-2xl backdrop-blur-xl transition-all hover:border-primary/30">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-start justify-between gap-3"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      {account.fb_user_image ? (
                        <Image
                          src={account.fb_user_image}
                          alt={account.fb_user_name || 'Facebook user image'}
                          width={48}
                          height={48}
                          className="rounded-full shadow-sm ring-2 ring-transparent transition-all group-hover:ring-primary/20"
                          unoptimized
                        />
                      ) : (
                        <motion.div
                          initial={{ scale: 0.95 }}
                          animate={{ scale: 1 }}
                          className="flex h-12 w-12 items-center justify-center rounded-full bg-muted ring-2 ring-transparent transition-all group-hover:ring-primary/20"
                        >
                          <User className="h-5 w-5 text-muted-foreground" />
                        </motion.div>
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
                          disabled={isPending}
                          title="Disconnect account"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-2xl border-border/50 bg-card/95 backdrop-blur-xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="font-display">
                            Disconnect Facebook Account?
                          </AlertDialogTitle>
                          <AlertDialogDescription className="text-muted-foreground">
                            Are you sure you want to disconnect{' '}
                            <strong>{account.fb_user_name}</strong>? All associated pages will also
                            be removed. This action cannot be undone.
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
                            disabled={isPending}
                          >
                            {isPending ? 'Disconnecting...' : 'Disconnect'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </motion.div>

                  <div className="mt-4 border-t border-border/50 pt-4">
                    <div className="flex items-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <Calendar className="mr-2 h-3.5 w-3.5 text-primary/50" />
                      Connected {format(new Date(account.created_at ?? new Date()), 'MMM dd, yyyy')}
                    </div>
                  </div>

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="mt-4"
                  >
                    <AddFacebookAccountDialog
                      reconnectAccountId={account.id}
                      reconnectAccountName={account.fb_user_name || undefined}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full rounded-full"
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Reconnect
                      </Button>
                    </AddFacebookAccountDialog>
                  </motion.div>
                </div>
              </motion.div>
            ))}
          </div>

          {filteredAccounts.length > ACCOUNTS_PAGE_SIZE && (
            <div className="flex items-center justify-center gap-4 py-4">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </motion.div>
  )
}
