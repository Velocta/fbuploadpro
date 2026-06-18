import { Suspense } from 'react'
import Link from 'next/link'
import { getSessionUser, createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FacebookAccountsList } from './fb-accounts-list'
import { AddFacebookAccountDialog } from './add-fb-account-dialog'
import { listAgencyFacebookAccountsEnriched } from '@/server/services/agency/facebook-accounts'
import { AgencyGlassPageHero } from '@/components/dashboard/agency'
import { Button } from '@/components/ui/button'
import { Building2, Settings2 } from 'lucide-react'

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

async function FacebookAccountsLoader({ userId, hasFacebookApp }: { userId: string; hasFacebookApp: boolean }) {
  const { accounts, summary } = await listAgencyFacebookAccountsEnriched(userId)

  return (
    <FacebookAccountsList
      accounts={accounts}
      summary={summary}
      hasFacebookApp={hasFacebookApp}
    />
  )
}

export default async function AgencyFacebookPage() {
  const user = await getSessionUser()

  if (!user) redirect('/login')

  const supabase = await createClient()
  const { data: agencySettings } = await supabase
    .from('users')
    .select('fb_app_id, fb_app_secret')
    .eq('id', user.id)
    .single()

  const hasFacebookApp = Boolean(
    agencySettings?.fb_app_id?.trim() && agencySettings?.fb_app_secret?.trim(),
  )

  return (
    <div className="space-y-6 pb-8 agency-motion-standard">
      <AgencyGlassPageHero
        segments={[
          { label: 'Agency', href: '/agency' },
          { label: 'FB Accounts' },
        ]}
        icon={<Building2 className="h-7 w-7 text-primary" />}
        title="Facebook accounts"
        description={
          hasFacebookApp
            ? 'Manage connected Facebook accounts, token health, and reconnect when needed.'
            : 'Connect your Facebook app in Settings before linking accounts.'
        }
        actions={
          hasFacebookApp ? (
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
      />

      <Suspense fallback={<AccountsSkeleton />}>
        <FacebookAccountsLoader userId={user.id} hasFacebookApp={hasFacebookApp} />
      </Suspense>
    </div>
  )
}
