import Link from 'next/link'
import { TerminalBreadcrumbs } from '@/components/dashboard/terminal-breadcrumbs'
import { AgencyPageHeader } from '@/components/dashboard/agency'
import { Button } from '@/components/ui/button'
import { InappSchedulePagesClient } from './pages-client'

export default function InappSchedulePagesPage() {
  return (
    <div className="space-y-6">
      <TerminalBreadcrumbs
        segments={[
          { label: 'Agency', href: '/agency' },
          { label: 'Facebook', href: '/agency/facebook/accounts' },
          { label: 'InApp Schedule', href: '/agency/facebook/inapp-schedule' },
          { label: 'Manage pages' },
        ]}
      />
      <AgencyPageHeader
        title="InApp Schedule — Pages"
        description="Saved pages for the in-app publishing queue."
        actions={
          <Button variant="outline" asChild>
            <Link href="/agency/facebook/inapp-schedule">Back to queue</Link>
          </Button>
        }
      />
      <InappSchedulePagesClient />
    </div>
  )
}
