'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Facebook, Trash2, Calendar, User, RefreshCw } from 'lucide-react'
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
import {
  AgencyEmptyState,
  AgencyInlineStatus,
  AgencySectionCard,
} from '@/components/dashboard/agency'

export function FacebookAccountsList({ accounts }: { accounts: FacebookAccount[] }) {
  const [isPending, startTransition] = useTransition()

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
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {accounts.map((account) => (
        <AgencySectionCard
          key={account.id}
          className="overflow-hidden hover:border-primary/30"
        >
          <CardHeader className="p-5 pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                {account.fb_user_image ? (
                  <div className="relative h-10 w-10">
                    <Image
                      src={account.fb_user_image || ''}
                      alt={account.fb_user_name || 'Facebook user image'}
                      fill
                      className="rounded-full object-cover border border-primary/20"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div className="min-w-0">
                  <CardTitle className="text-base font-display font-bold text-foreground truncate">
                    {account.fb_user_name}
                  </CardTitle>
                  <CardDescription className="mt-1 truncate font-mono text-xs uppercase tracking-wide text-primary/80">
                    ID: {account.fb_user_id}
                  </CardDescription>
                </div>
              </div>
              <div className="flex gap-1">
                <AddFacebookAccountDialog reconnectAccountId={account.id}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"
                    title="Reconnect & Update Tokens"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </AddFacebookAccountDialog>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      disabled={isPending}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="border-border bg-card">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="font-display">Disconnect Facebook Account?</AlertDialogTitle>
                      <AlertDialogDescription className="text-muted-foreground">
                        Are you sure you want to disconnect <strong>{account.fb_user_name}</strong>?
                        All associated pages will also be removed. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="h-11 px-6 font-bold">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(account.id, account.fb_user_name || 'this account')}
                        className="bg-destructive text-destructive-foreground font-bold h-11 px-6 hover:bg-destructive/90"
                        disabled={isPending}
                      >
                        {isPending ? 'Disconnecting...' : 'Disconnect'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardHeader>
          <CardContent className="border-t border-border/70 p-5 pt-3">
            <div className="flex items-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Calendar className="mr-2 h-3.5 w-3.5 text-primary/50" />
              Connected {format(new Date(account.created_at ?? new Date()), 'MMM dd, yyyy')}
            </div>
            <div className="mt-3">
              <AgencyInlineStatus label={`BYOC ${account.fb_app_id}`} />
            </div>
          </CardContent>
        </AgencySectionCard>
      ))}
    </div>
  )
}
