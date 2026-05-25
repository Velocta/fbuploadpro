import Link from 'next/link'
import { getSessionUser, createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FacebookAccountsList } from './fb-accounts-list'
import { AddFacebookAccountDialog } from './add-fb-account-dialog'
import { listAgencyFacebookAccountsEnriched } from '@/server/services/agency/facebook-accounts'
import { AgencyGlassPageHero } from '@/components/dashboard/agency'
import { Button } from '@/components/ui/button'
import { Building2, Settings2 } from 'lucide-react'

export default async function AgencyFacebookPage() {
  const user = await getSessionUser()

  if (!user) redirect('/login')

  const supabase = await createClient()
  const [{ data: agencySettings }, { accounts, summary }] = await Promise.all([
    supabase
      .from('users')
      .select('fb_app_id, fb_app_secret')
      .eq('id', user.id)
      .single(),
    listAgencyFacebookAccountsEnriched(user.id),
  ])

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

      <FacebookAccountsList
        accounts={accounts}
        summary={summary}
        hasFacebookApp={hasFacebookApp}
      />
    </div>
  )
}
