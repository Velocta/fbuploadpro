import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TerminalBreadcrumbs } from '@/components/dashboard/terminal-breadcrumbs'
import { AgencySettingsClient } from './settings-client'
import { AgencyPageHeader } from '@/components/dashboard/agency'

export default async function AgencySettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: agencySettings } = await supabase
    .from('users')
    .select('fb_app_id, fb_app_secret, fb_app_name')
    .eq('id', user.id)
    .single()

  return (
    <div className="space-y-6 agency-motion-standard">
      <TerminalBreadcrumbs
        segments={[
          { label: 'Agency', href: '/agency' },
          { label: 'Settings' },
        ]}
      />
      <AgencyPageHeader
        title="Agency settings"
        description="Manage your agency configuration and API credentials."
        className="pb-5"
      />

      <AgencySettingsClient initialSettings={agencySettings} />
    </div>
  )
}
