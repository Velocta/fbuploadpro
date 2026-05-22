import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AddPageDialog } from './add-page-dialog'
import { PagesClient } from './pages-client'
import { TerminalBreadcrumbs } from '@/components/dashboard/terminal-breadcrumbs'
import { AgencyPageHeader } from '@/components/dashboard/agency'

export default async function AgencyPagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch Agency Pages with Reels Stats
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
      facebook_accounts(fb_user_name, fb_user_image)
    `)
    .eq('agency_id', user.id)
    .order('created_at', { ascending: false })

  const totalGainedFollowers = (pages || []).reduce((sum, page) => {
    const gained = Math.max((page.followers_gained || 0) - (page.followers_count || 0), 0)
    return sum + gained
  }, 0)
  const totalFollowersAcrossPages = (pages || []).reduce((sum, page) => {
    return sum + (page.followers_gained || 0)
  }, 0)

  return (
    <div className="space-y-6 agency-motion-standard">
      <TerminalBreadcrumbs
        segments={[
          { label: 'Agency', href: '/agency' },
          { label: 'Pages' },
        ]}
      />
      <AgencyPageHeader
        title="Manage pages"
        description="Connected Facebook pages for automated posting."
        actions={<AddPageDialog agencyId={user.id} />}
      />

      {/* Pages Section */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center">
            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs mr-2">
              {pages?.length || 0} Total Pages
            </span>
            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs mr-2">
              {totalGainedFollowers.toLocaleString()} Total Gained Followers
            </span>
            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs mr-2">
              {totalFollowersAcrossPages.toLocaleString()} Total Followers
            </span>
            Active Automation Pages
          </h2>
        </div>

        <PagesClient initialPages={pages || []} />
      </div>
    </div>
  )
}
