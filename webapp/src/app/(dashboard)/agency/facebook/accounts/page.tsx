import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FacebookAccountsList } from './fb-accounts-list'

export default async function AgencyFacebookPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="space-y-6 pb-8 agency-motion-standard">
      <FacebookAccountsList />
    </div>
  )
}
