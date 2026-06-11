import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AddPageDialog } from './add-page-dialog'
import { PagesClient } from './pages-client'
import { AgencyGlassPageHero } from '@/components/dashboard/agency'
import { Download, Layers, TrendingUp, Users } from 'lucide-react'
import { getStartOfTodayInTimezone } from '@/lib/timezones'

export default async function AgencyPagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: pages } = await supabase
    .from('pages')
    .select(`
      id,
      page_name,
      fb_page_id,
      fb_page_image,
      followers_count,
      followers_gained,
      created_at,
      status,
      sync_status,
      source_platform,
      source_username,
      pending_reels_count,
      posted_reels_count,
      failed_reels_count,
      posts_per_day,
      timezone,
      facebook_accounts(fb_user_name, fb_user_image)
    `)
    .eq('agency_id', user.id)
    .order('created_at', { ascending: false })

  // Fetch only finished posting jobs updated/published in the last 48 hours for pages belonging to this agency
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000)
  const { data: recentJobs } = await supabase
    .from('adu_posting_jobs')
    .select('page_id, status, updated_at')
    .eq('agency_id', user.id)
    .in('status', ['published', 'failed_to_publish', 'publish_error', 'integrity_error'])
    .gte('updated_at', fortyEightHoursAgo.toISOString())

  const pagesWithTodayStats = (pages || []).map((p) => {
    const timezone = p.timezone || 'UTC'
    const pageMidnight = getStartOfTodayInTimezone(timezone)
    
    let postedToday = 0
    let failedToday = 0
    
    for (const job of recentJobs || []) {
      if (job.page_id !== p.id) continue
      
      const jobTime = new Date(job.updated_at)
      if (jobTime >= pageMidnight) {
        if (job.status === 'published') {
          postedToday += 1
        } else if (['failed_to_publish', 'publish_error', 'integrity_error'].includes(job.status)) {
          failedToday += 1
        }
      }
    }

    return {
      ...p,
      posted_today: postedToday,
      failed_today: failedToday,
    }
  })

  const totalGainedFollowers = pagesWithTodayStats.reduce((sum, page) => {
    const gained = Math.max((page.followers_gained || 0) - (page.followers_count || 0), 0)
    return sum + gained
  }, 0)
  const totalFollowersAcrossPages = pagesWithTodayStats.reduce((sum, page) => {
    return sum + (page.followers_gained || 0)
  }, 0)

  const stats = [
    {
      label: 'Total Pages',
      value: (pagesWithTodayStats.length || 0).toLocaleString(),
      icon: Layers,
    },
    {
      label: 'Followers Gained',
      value: totalGainedFollowers.toLocaleString(),
      icon: TrendingUp,
    },
    {
      label: 'Total Followers',
      value: totalFollowersAcrossPages.toLocaleString(),
      icon: Users,
    },
  ]

  return (
    <div className="space-y-6 pb-8 agency-motion-standard">
      <AgencyGlassPageHero
        segments={[
          { label: 'Agency', href: '/agency' },
          { label: 'Auto Download/Upload' },
        ]}
        icon={<Download className="h-7 w-7 text-primary" />}
        title="Auto Download/Upload"
        description="Connected Facebook pages for automated reel download and posting."
        actions={<AddPageDialog agencyId={user.id} />}
      />

      <div className="relative group">
        <div
          className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 to-blue-500/20 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100"
          aria-hidden
        />
        <div className="relative grid gap-4 rounded-2xl border border-border/50 bg-card/40 p-5 shadow-2xl backdrop-blur-xl sm:grid-cols-3">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <div
                key={stat.label}
                className="rounded-xl border border-border/50 bg-background/30 p-4"
              >
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Icon className="h-4 w-4 text-primary" />
                  {stat.label}
                </div>
                <p className="font-display text-2xl font-bold tracking-tight">{stat.value}</p>
              </div>
            )
          })}
        </div>
      </div>

      <PagesClient initialPages={pagesWithTodayStats} />
    </div>
  )
}
