import Link from 'next/link'
import { TerminalBreadcrumbs } from '@/components/dashboard/terminal-breadcrumbs'
import { AgencyPageHeader } from '@/components/dashboard/agency'
import { Button } from '@/components/ui/button'
import { DirectSchedulePagesClient } from './pages-client'

export default function DirectSchedulePagesPage() {
  return (
    <div className="space-y-6">
      <TerminalBreadcrumbs
        segments={[
          { label: 'Agency', href: '/agency' },
          { label: 'Facebook', href: '/agency/facebook/accounts' },
          { label: 'Direct Schedule', href: '/agency/facebook/direct-schedule' },
          { label: 'Manage pages' },
        ]}
      />
      <AgencyPageHeader
        title="Direct Schedule — Pages"
        description="Save Facebook Pages used for native scheduled publishing."
        actions={
          <Button variant="outline" asChild>
            <Link href="/agency/facebook/direct-schedule">Back to schedule</Link>
          </Button>
        }
      />
      <DirectSchedulePagesClient />
    </div>
  )
}
