import { ComingSoon } from '@/components/dashboard/coming-soon'
import { AgencyPageHeader } from '@/components/dashboard/agency'

export default function InstagramDirectScheduleShell() {
  return (
    <div className="space-y-6">
      <AgencyPageHeader title="Instagram — Direct Schedule" description="Coming soon." />
      <ComingSoon title="Instagram Direct Schedule" />
    </div>
  )
}
