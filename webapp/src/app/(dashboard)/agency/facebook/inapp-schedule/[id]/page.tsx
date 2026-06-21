import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { InappPageDetailHeader } from './inapp-page-detail-header'
import { InappPageDetailTabs } from './inapp-page-detail-tabs'
import { QueueTabClient } from './tabs/queue-tab-client'
import { HistoryTabClient } from './tabs/history-tab-client'
import { getInappSchedulePageStats } from '@/server/services/facebook/inapp-schedule-service'

export default async function InappSchedulePageDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return notFound()

  const { data: page } = await supabase
    .from('facebook_inapp_schedule_pages')
    .select(`
      id,
      fb_page_id,
      fb_page_name,
      fb_page_image,
      fb_page_access_token,
      created_at,
      status,
      rate_limited_until,
      followers_count,
      followers_gained,
      changed_followers,
      is_followers_updated,
      facebook_accounts(fb_user_name, fb_user_image)
    `)
    .eq('id', id)
    .eq('agency_id', user.id)
    .single()

  if (!page) return notFound()

  const stats = await getInappSchedulePageStats(user.id, page.id)

  return (
    <div className="space-y-6 pb-8 agency-motion-standard">
      <InappPageDetailHeader page={page} stats={stats} />
      <InappPageDetailTabs
        queue={<QueueTabClient pageId={page.id} />}
        history={<HistoryTabClient pageId={page.id} />}
      />
    </div>
  )
}
