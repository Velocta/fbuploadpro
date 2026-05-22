import { ComingSoon } from '@/components/dashboard/coming-soon'
import { AgencyPageHeader } from '@/components/dashboard/agency'

export default function InstagramAccountsShell() {
  return (
    <div className="space-y-6">
      <AgencyPageHeader title="Instagram — Accounts" description="Coming soon." />
      <ComingSoon title="Instagram" />
    </div>
  )
}
