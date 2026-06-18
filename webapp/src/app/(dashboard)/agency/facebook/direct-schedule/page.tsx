import { AddSchedulePageDialog } from './add-schedule-page-dialog'
import { SchedulePagesClient } from './schedule-pages-client'
import { AgencyGlassPageHero } from '@/components/dashboard/agency'
import { CalendarClock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function FacebookDirectSchedulePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="space-y-6 pb-8 agency-motion-standard">
      <AgencyGlassPageHero
        segments={[
          { label: 'Agency', href: '/agency' },
          { label: 'Direct Schedule' },
        ]}
        icon={<CalendarClock className="h-7 w-7 text-primary" />}
        title="Direct Schedule"
        description="Schedule posts natively on Facebook."
        actions={<AddSchedulePageDialog agencyId={user.id} />}
      />

      <SchedulePagesClient userId={user.id} />
    </div>
  )
}
