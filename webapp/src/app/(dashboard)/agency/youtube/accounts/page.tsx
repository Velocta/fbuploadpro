import { ComingSoon } from '@/components/dashboard/coming-soon'
import { AgencyPageHeader } from '@/components/dashboard/agency'

export default function YoutubeAccountsShell() {
  return (
    <div className="space-y-6">
      <AgencyPageHeader title="YouTube — Accounts" description="Connect YouTube channels (coming soon)." />
      <ComingSoon title="YouTube" />
    </div>
  )
}
