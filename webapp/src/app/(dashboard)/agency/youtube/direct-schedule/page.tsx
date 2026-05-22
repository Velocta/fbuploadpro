import { ComingSoon } from '@/components/dashboard/coming-soon'
import { AgencyPageHeader } from '@/components/dashboard/agency'

export default function YoutubeDirectScheduleShell() {
  return (
    <div className="space-y-6">
      <AgencyPageHeader title="YouTube — Direct Schedule" description="Coming soon." />
      <ComingSoon title="YouTube Direct Schedule" />
    </div>
  )
}
