import { getSessionUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FacebookAccountsList } from './fb-accounts-list'
import { AddFacebookAccountDialog } from './add-fb-account-dialog'
import { listAgencyFacebookAccounts } from '@/server/services/agency/facebook-accounts'
import { AgencyGlassPageHero } from '@/components/dashboard/agency'
import { Building2 } from 'lucide-react'

export default async function AgencyFacebookPage() {
  const user = await getSessionUser()

  if (!user) redirect('/login')

  // Fetch FB Accounts
  const accounts = await listAgencyFacebookAccounts(user.id)

  return (
    <div className="space-y-6 pb-8 agency-motion-standard">
      <AgencyGlassPageHero
        segments={[
          { label: 'Agency', href: '/agency' },
          { label: 'FB Accounts' },
        ]}
        icon={<Building2 className="h-7 w-7 text-primary" />}
        title="Facebook accounts"
        description="Manage your connected Facebook accounts and their permissions."
        actions={<AddFacebookAccountDialog />}
      />

      <FacebookAccountsList accounts={accounts} />
    </div>
  )
}
