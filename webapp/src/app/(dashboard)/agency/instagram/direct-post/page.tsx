import { ComingSoon } from '@/components/dashboard/coming-soon'
import { AgencyPageHeader } from '@/components/dashboard/agency'

export default function InstagramDirectPostShell() {
  return (
    <div className="space-y-6">
      <AgencyPageHeader title="Instagram — Direct Post" description="Coming soon." />
      <ComingSoon title="Instagram Direct Post" />
    </div>
  )
}
