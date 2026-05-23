import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

import { InsightsTab } from './insights-tab'
import { PageDetailAlerts } from './page-detail-alerts'
import { PageDetailHeader } from './page-detail-header'
import { PageDetailOverview } from './page-detail-overview'
import { PageDetailTabs } from './page-detail-tabs'
import { ReelsTab } from './reels-tab'
import { SettingsForm, type Page } from './settings-form'

export default async function PageDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('pages')
    .select(`
      id, 
      page_name, 
      source_platform, 
      source_username, 
      fb_page_access_token, 
      fb_page_id, 
      posts_per_day, 
      schedule_type, 
      status, 
      timezone, 
      posting_times, 
      fb_page_image, 
      sync_status, 
      created_at,
      followers_count,
      followers_gained,
      pending_reels_count,
      posted_reels_count,
      failed_reels_count,
      facebook_accounts(fb_user_name, fb_user_id, fb_user_image)
    `)
    .eq('id', id)
    .single()

  if (!profile) return notFound()

  const pendingReels = profile.pending_reels_count || 0
  const postedReels = profile.posted_reels_count || 0
  const failedReels = profile.failed_reels_count || 0
  const currentFollowers = profile.followers_gained || 0
  const startingFollowers = profile.followers_count || 0
  const followersDelta = currentFollowers - startingFollowers

  const pageProfile = profile as unknown as Page & {
    sync_status: string | null
    created_at: string | null
    followers_count: number | null
    followers_gained: number | null
  }

  return (
    <div className="space-y-6 pb-8 agency-motion-standard">
      <PageDetailHeader profile={pageProfile} />
      <PageDetailAlerts profile={pageProfile} />
      <PageDetailTabs
        overview={
          <PageDetailOverview
            pendingReels={pendingReels}
            postedReels={postedReels}
            failedReels={failedReels}
            followersDelta={followersDelta}
          />
        }
        insights={
          <InsightsTab
            fbPageId={profile.fb_page_id}
            pageAccessToken={profile.fb_page_access_token || ''}
          />
        }
        reels={<ReelsTab pageId={profile.id} />}
        settings={<SettingsForm profile={pageProfile} />}
      />
    </div>
  )
}
