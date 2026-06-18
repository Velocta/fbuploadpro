import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AddSchedulePageDialog } from './add-schedule-page-dialog'
import { SchedulePagesClient } from './schedule-pages-client'
import { AgencyGlassPageHero } from '@/components/dashboard/agency'
import { CalendarClock, Layers, TrendingUp, XCircle } from 'lucide-react'
import { getAgencyScheduleStats } from '@/server/services/facebook/direct-schedule-service'

function DirectScheduleSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats Skeleton */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl border border-border/50 bg-card/40 p-5 animate-pulse flex flex-col justify-between">
            <div className="h-4 w-24 bg-muted/20 rounded" />
            <div className="h-6 w-16 bg-muted/20 rounded" />
          </div>
        ))}
      </div>

      {/* Pages Grid Skeleton */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[200px] rounded-2xl border border-border/50 bg-card/40 p-5 animate-pulse flex flex-col justify-between">
            <div className="flex gap-3">
              <div className="h-12 w-12 bg-muted/20 rounded-lg" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-32 bg-muted/20 rounded" />
                <div className="h-3 w-20 bg-muted/20 rounded" />
              </div>
            </div>
            <div className="h-10 bg-muted/20 rounded-lg w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

async function DirectScheduleLoader({ userId }: { userId: string }) {
  const supabase = await createClient()
  const { data: pages } = await supabase
    .from('facebook_direct_schedule_pages')
    .select(`
      id,
      fb_page_id,
      fb_page_name,
      fb_page_image,
      created_at,
      facebook_accounts(fb_user_name, fb_user_image)
    `)
    .eq('agency_id', userId)
    .order('created_at', { ascending: false })

  const stats = await getAgencyScheduleStats(userId)

  const uiStats = [
    {
      label: 'Total Pages',
      value: (pages?.length || 0).toLocaleString(),
      icon: Layers,
    },
    {
      label: 'Scheduled Posts',
      value: stats.scheduled.toLocaleString(),
      icon: TrendingUp,
    },
    {
      label: 'Failed Posts',
      value: stats.failed.toLocaleString(),
      icon: XCircle,
    },
  ]

  const formattedPages = (pages || []).map((p) => ({
    id: p.id,
    fb_page_id: p.fb_page_id,
    fb_page_name: p.fb_page_name,
    fb_page_image: p.fb_page_image,
    created_at: p.created_at,
    facebook_accounts: Array.isArray(p.facebook_accounts)
      ? p.facebook_accounts[0] || null
      : p.facebook_accounts || null,
  }))

  return (
    <div className="space-y-6">
      <div className="relative group">
        <div
          className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 to-blue-500/20 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100"
          aria-hidden
        />
        <div className="relative grid gap-4 rounded-2xl border border-border/50 bg-card/40 p-5 shadow-2xl backdrop-blur-xl sm:grid-cols-3">
          {uiStats.map((stat) => {
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

      <SchedulePagesClient initialPages={formattedPages} />
    </div>
  )
}

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

      <Suspense fallback={<DirectScheduleSkeleton />}>
        <DirectScheduleLoader userId={user.id} />
      </Suspense>
    </div>
  )
}
