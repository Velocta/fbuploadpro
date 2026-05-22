import { getSessionUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TerminalBreadcrumbs } from '@/components/dashboard/terminal-breadcrumbs'
import { FacebookAccountsList } from './fb-accounts-list'
import { AddFacebookAccountDialog } from './add-fb-account-dialog'
import { listAgencyFacebookAccounts } from '@/server/services/agency/facebook-accounts'
import { AgencyPageHeader } from '@/components/dashboard/agency'

export default async function AgencyFacebookPage() {
  const user = await getSessionUser()

  if (!user) redirect('/login')

  // Fetch FB Accounts
  const accounts = await listAgencyFacebookAccounts(user.id)

  return (
    <div className="space-y-6 agency-motion-standard">
      <TerminalBreadcrumbs
        segments={[
          { label: 'Agency', href: '/agency' },
          { label: 'FB Accounts' },
        ]}
      />
      <AgencyPageHeader
        title="Facebook accounts"
        description="Manage your connected Facebook accounts and their permissions."
        actions={<AddFacebookAccountDialog />}
      />

      <FacebookAccountsList accounts={accounts} />
    </div>
  )
}
