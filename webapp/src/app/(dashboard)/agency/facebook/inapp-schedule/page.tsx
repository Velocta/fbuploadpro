import { TerminalBreadcrumbs } from '@/components/dashboard/terminal-breadcrumbs'
import { AgencyPageHeader } from '@/components/dashboard/agency'
import { InappScheduleClient } from './inapp-schedule-client'

export default function FacebookInappSchedulePage() {
  return (
    <div className="space-y-6">
      <TerminalBreadcrumbs
        segments={[
          { label: 'Agency', href: '/agency' },
          { label: 'Facebook', href: '/agency/facebook/accounts' },
          { label: 'InApp Schedule' },
        ]}
      />
      <AgencyPageHeader
        title="InApp Schedule"
        description="Queue posts in FBUpload Pro and publish at the scheduled time."
      />
      <InappScheduleClient />
    </div>
  )
}
