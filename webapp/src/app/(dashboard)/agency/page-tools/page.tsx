import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TerminalBreadcrumbs } from '@/components/dashboard/terminal-breadcrumbs'
import { AgencyPageHeader } from '@/components/dashboard/agency'
import { PageToolsClient } from './page-tools-client'

export default async function AgencyPageToolsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="space-y-6 agency-motion-standard">
      <TerminalBreadcrumbs
        segments={[
          { label: 'Agency', href: '/agency' },
          { label: 'Page Tools' },
        ]}
      />
      <AgencyPageHeader
        title="Page Tools"
        description="View live Facebook page content and bulk delete selected items."
      />
      <PageToolsClient />
    </div>
  )
}

