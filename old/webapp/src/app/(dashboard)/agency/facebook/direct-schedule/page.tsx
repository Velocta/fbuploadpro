import { SchedulePagesClient } from './schedule-pages-client'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function FacebookDirectSchedulePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="pb-8 agency-motion-standard">
      <SchedulePagesClient userId={user.id} />
    </div>
  )
}

