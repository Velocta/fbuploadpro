import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

import { InsightsTab } from './insights-tab'
import { PageDetailAlerts } from './page-detail-alerts'
import { PageDetailHeader } from './page-detail-header'
import { PageDetailOverview } from './page-detail-overview'
import { PageDetailTabs } from './page-detail-tabs'
import { ReelsTab } from './reels-tab'
import { SettingsForm, type Page } from './settings-form'
import { FailedPostsTab } from './failed-posts-tab'
import { getStartOfTodayInTimezone } from '@/lib/timezones'

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

  const pageMidnight = getStartOfTodayInTimezone(profile.timezone || 'UTC')

  // Fetch today's posting jobs to count posted and failed today (using page timezone midnight)
  const { data: todayJobs } = await supabase
    .from('adu_posting_jobs')
    .select('status')
    .eq('page_id', id)
    .in('status', ['published', 'failed_to_publish', 'publish_error', 'integrity_error'])
    .gte('updated_at', pageMidnight.toISOString())

  let postedToday = 0
  let failedToday = 0
  for (const job of todayJobs || []) {
    if (job.status === 'published') {
      postedToday += 1
    } else if (['failed_to_publish', 'publish_error', 'integrity_error'].includes(job.status)) {
      failedToday += 1
    }
  }

  // Fetch all failed jobs and reasons
  const { data: failedJobs } = await supabase
    .from('adu_posting_jobs')
    .select('job_id, reel_id, reel_caption, status, last_error_code, last_error_message, updated_at')
    .eq('page_id', id)
    .in('status', ['failed_to_publish', 'publish_error', 'integrity_error'])
    .order('updated_at', { ascending: false })

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
            postsPerDay={profile.posts_per_day || 0}
            postedToday={postedToday}
            failedToday={failedToday}
          />
        }
        insights={
          <InsightsTab
            fbPageId={profile.fb_page_id}
            pageAccessToken={profile.fb_page_access_token || ''}
          />
        }
        reels={<ReelsTab pageId={profile.id} />}
        failedPosts={<FailedPostsTab failedJobs={failedJobs || []} />}
        settings={<SettingsForm profile={pageProfile} />}
      />
    </div>
  )
}
