import { TerminalBreadcrumbs } from '@/components/dashboard/terminal-breadcrumbs'
import { AgencyPageHeader } from '@/components/dashboard/agency'
import { DirectScheduleClient } from './direct-schedule-client'

export default function FacebookDirectSchedulePage() {
  return (
    <div className="space-y-6">
      <TerminalBreadcrumbs
        segments={[
          { label: 'Agency', href: '/agency' },
          { label: 'Facebook', href: '/agency/facebook/accounts' },
          { label: 'Direct Schedule' },
        ]}
      />
      <AgencyPageHeader
        title="Direct Schedule"
        description="Schedule posts on Facebook using native scheduled publish times."
      />
      <DirectScheduleClient />
    </div>
  )
}
