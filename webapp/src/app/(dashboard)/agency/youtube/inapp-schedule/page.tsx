import { ComingSoon } from '@/components/dashboard/coming-soon'
import { AgencyPageHeader } from '@/components/dashboard/agency'

export default function YoutubeInappScheduleShell() {
  return (
    <div className="space-y-6">
      <AgencyPageHeader title="YouTube — InApp Schedule" description="Coming soon." />
      <ComingSoon title="YouTube InApp Schedule" />
    </div>
  )
}
