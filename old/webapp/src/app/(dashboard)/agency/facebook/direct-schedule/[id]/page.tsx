import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { SchedulePageDetailHeader } from './schedule-page-detail-header'
import { SchedulePageDetailTabs } from './schedule-page-detail-tabs'
import { OverviewTab } from './tabs/overview-tab'
import { InsightsTab } from './tabs/insights-tab'
import { HistoryTab } from './tabs/history-tab'
import { LiveScheduledTab } from './tabs/live-scheduled-tab'
import { getSchedulePageStats } from '@/server/services/facebook/direct-schedule-service'

export default async function DirectSchedulePageDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return notFound()

  const { data: page } = await supabase
    .from('facebook_direct_schedule_pages')
    .select(`
      id,
      fb_page_id,
      fb_page_name,
      fb_page_image,
      fb_page_access_token,
      created_at,
      facebook_accounts(fb_user_name, fb_user_image)
    `)
    .eq('id', id)
    .eq('agency_id', user.id)
    .single()

  if (!page) return notFound()

  const stats = await getSchedulePageStats(user.id, page.id)

  return (
    <div className="space-y-6 pb-8 agency-motion-standard">
      <SchedulePageDetailHeader page={page} stats={stats} />
      <SchedulePageDetailTabs
        overview={
          <OverviewTab stats={stats} />
        }
        insights={
          <InsightsTab
            fbPageId={page.fb_page_id}
            pageAccessToken={page.fb_page_access_token || ''}
          />
        }
        history={
          <HistoryTab pageId={page.id} />
        }
        scheduled={
          <LiveScheduledTab
            fbPageId={page.fb_page_id}
            pageAccessToken={page.fb_page_access_token || ''}
          />
        }
      />
    </div>
  )
}
