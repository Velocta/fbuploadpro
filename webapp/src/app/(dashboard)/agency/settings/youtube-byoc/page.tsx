import { ComingSoon } from '@/components/dashboard/coming-soon'
import { AgencyPageHeader } from '@/components/dashboard/agency'

export default function YoutubeByocShell() {
  return (
    <div className="space-y-6">
      <AgencyPageHeader title="YouTube BYOC" description="Bring your own YouTube API app (coming soon)." />
      <ComingSoon title="YouTube BYOC" />
    </div>
  )
}
