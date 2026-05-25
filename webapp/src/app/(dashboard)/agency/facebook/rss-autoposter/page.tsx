import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AlertCircle, CheckCircle2, Rss } from 'lucide-react'
import { AgencyGlassPageHero } from '@/components/dashboard/agency'
import { AddRssPageDialog } from '@/features/rss-autoposter/ui/add-rss-page-dialog'
import { RssPagesClient } from '@/features/rss-autoposter/ui/pages-client'
import { getRssAgencyStats, listRssPages } from '@/server/services/facebook/rss-autoposter-service'

export default async function RssAutoposterHubPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const pages = await listRssPages(user.id)
  const stats = await getRssAgencyStats(user.id)

  const statItems = [
    {
      label: 'Pages',
      value: pages.length.toLocaleString(),
      icon: Rss,
    },
    {
      label: 'Published (7d)',
      value: stats.published.toLocaleString(),
      icon: CheckCircle2,
    },
    {
      label: 'Failed (7d)',
      value: stats.failed.toLocaleString(),
      icon: AlertCircle,
    },
  ]

  return (
    <div className="space-y-6 pb-8 agency-motion-standard">
      <AgencyGlassPageHero
        segments={[{ label: 'Agency', href: '/agency' }, { label: 'RSS Auto Poster' }]}
        icon={<Rss className="h-7 w-7 text-primary" />}
        title="RSS Auto Poster"
        description="Connect Facebook Pages to RSS feeds with branded image templates and scheduled posting."
        actions={<AddRssPageDialog agencyId={user.id} />}
      />

      <div className="relative group">
        <div
          className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 to-blue-500/20 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100"
          aria-hidden
        />
        <div className="relative grid gap-4 rounded-2xl border border-border/50 bg-card/40 p-5 shadow-2xl backdrop-blur-xl sm:grid-cols-3">
          {statItems.map((stat) => {
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

      <RssPagesClient initialPages={pages} agencyId={user.id} />
    </div>
  )
}
