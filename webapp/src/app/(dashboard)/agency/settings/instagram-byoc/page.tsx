import { ComingSoon } from '@/components/dashboard/coming-soon'
import { AgencyPageHeader } from '@/components/dashboard/agency'

export default function InstagramByocShell() {
  return (
    <div className="space-y-6">
      <AgencyPageHeader title="Instagram BYOC" description="Bring your own Instagram API app (coming soon)." />
      <ComingSoon title="Instagram BYOC" />
    </div>
  )
}
