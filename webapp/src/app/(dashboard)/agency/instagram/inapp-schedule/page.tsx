import { ComingSoon } from '@/components/dashboard/coming-soon'
import { AgencyPageHeader } from '@/components/dashboard/agency'

export default function InstagramInappScheduleShell() {
  return (
    <div className="space-y-6">
      <AgencyPageHeader title="Instagram — InApp Schedule" description="Coming soon." />
      <ComingSoon title="Instagram InApp Schedule" />
    </div>
  )
}
