import { TerminalBreadcrumbs } from '@/components/dashboard/terminal-breadcrumbs'
import { AgencyPageHeader } from '@/components/dashboard/agency'
import { DirectPostClient } from './direct-post-client'

export default function FacebookDirectPostPage() {
  return (
    <div className="space-y-6">
      <TerminalBreadcrumbs
        segments={[
          { label: 'Agency', href: '/agency' },
          { label: 'Facebook', href: '/agency/facebook/accounts' },
          { label: 'Direct Post' },
        ]}
      />
      <AgencyPageHeader
        title="Direct Post"
        description="Publish text, image, or video to a Facebook Page immediately."
      />
      <DirectPostClient />
    </div>
  )
}
