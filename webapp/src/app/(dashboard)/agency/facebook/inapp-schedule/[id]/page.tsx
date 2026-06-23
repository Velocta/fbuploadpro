import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { InappPageDetailHeader } from './inapp-page-detail-header'
import { InappPageDetailAlerts } from './inapp-page-detail-alerts'
import { InappPageDetailTabs } from './inapp-page-detail-tabs'
import { QueueTabClient } from './tabs/queue-tab-client'
import { HistoryTabClient } from './tabs/history-tab-client'
import { OverviewTab } from './tabs/overview-tab'
import { SettingsTabClient } from './tabs/settings-tab-client'
import { FacebookPageInsightsTab } from '@/components/dashboard/agency/facebook-page-insights-tab'
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
      posts_per_day,
      posting_times,
      schedule_timezone,
      facebook_accounts(fb_user_name, fb_user_image, fb_user_id)
    `)
    .eq('id', id)
    .eq('agency_id', user.id)
    .single()

  if (!page) return notFound()

  const stats = await getInappSchedulePageStats(user.id, page.id)

  return (
    <div className="space-y-6 pb-8 agency-motion-standard">
      <InappPageDetailHeader
        page={page}
        stats={{
          pending: stats.pending,
          posted: stats.published,
          failed: stats.failed,
        }}
      />
      <InappPageDetailAlerts status={page.status} />
      <InappPageDetailTabs
        overview={<OverviewTab stats={stats} page={page} />}
        insights={
          <FacebookPageInsightsTab
            fbPageId={page.fb_page_id}
            pageAccessToken={page.fb_page_access_token}
          />
        }
        queue={<QueueTabClient pageId={page.id} />}
        history={<HistoryTabClient pageId={page.id} />}
        settings={<SettingsTabClient page={page as unknown as Parameters<typeof SettingsTabClient>[0]['page']} />}
      />
    </div>
  )
}
