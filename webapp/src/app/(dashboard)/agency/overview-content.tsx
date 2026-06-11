import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  CheckCircle2,
  ChevronRight,
  Coins,
  Download,
  Layers,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AgencySectionCard, AgencyEmptyState, AgencyInlineStatus } from '@/components/dashboard/agency'
import { ADD_TOKENS_HREF } from '@/components/dashboard/nav-config'
import { DashboardQuickLinks, DashboardQuickLinksLocked } from './dashboard-quick-links'
import { DashboardScheduleSnapshot } from './dashboard-schedule-snapshot'
import { DashboardSetupChecklist } from './dashboard-setup-checklist'
import { DashboardRefreshButton } from './dashboard-refresh-button'
import { NeedsAttentionListClient } from './needs-attention-list-client'
import {
  aggregateOverviewStats,
  deriveAttentionSectionTitle,
  deriveAutomationHealth,
  tokenBalanceKpiSubcopy,
  type OverviewPageRow,
  type TokenBalanceTier,
} from './dashboard-overview-utils'

const ADU_HUB = '/agency/facebook/auto-download-upload'

function formatFetchedAt(date: Date): string {
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}



export async function DashboardOverviewContent({
  userId,
  tokensBalance,
  hasTokens,
  tokenTier,
  hasFacebookApp,
  fbAccountsCount,
  rssAutoposterEnabled = false,
}: {
  userId: string
  tokensBalance: number
  hasTokens: boolean
  tokenTier: TokenBalanceTier
  hasFacebookApp: boolean
  fbAccountsCount: number
  rssAutoposterEnabled?: boolean
}) {
  const supabase = await createClient()
  const lastFetched = formatFetchedAt(new Date())

  const [
    { data: pagesRaw },
    { count: inAppPending },
    { count: directScheduled },
  ] = await Promise.all([
    supabase
      .from('pages')
      .select(
        'id, page_name, fb_page_image, status, sync_status, pending_reels_count, posted_reels_count, failed_reels_count, followers_count, followers_gained',
      )
      .eq('agency_id', userId),
    supabase
      .from('facebook_inapp_schedule_posts')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', userId)
      .eq('status', 'pending'),
    supabase
      .from('facebook_direct_schedule_posts')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', userId)
      .eq('status', 'scheduled'),
  ])

  const pages = (pagesRaw ?? []) as OverviewPageRow[]
  const stats = aggregateOverviewStats(pages)
  const scheduleAttentionCount = (inAppPending ?? 0) + (directScheduled ?? 0)
  const attentionMeta = deriveAttentionSectionTitle(
    stats.nonActiveCount,
    scheduleAttentionCount,
  )
  const health = deriveAutomationHealth(hasTokens, stats.nonActiveCount)

  const showEmptyDelight = hasTokens && stats.totalPages === 0

  const kpiCards = [
    {
      label: 'Token balance',
      value: tokensBalance.toLocaleString(),
      sub: tokenBalanceKpiSubcopy(tokensBalance),
      icon: Coins,
      href: ADD_TOKENS_HREF,
    },
    {
      label: 'Connected pages',
      value: stats.totalPages.toLocaleString(),
      sub: `${stats.activePages.toLocaleString()} active · ${fbAccountsCount.toLocaleString()} FB accounts`,
      icon: Layers,
      href: ADU_HUB,
    },
    {
      label: 'Followers gained',
      value: stats.totalFollowersGained.toLocaleString(),
      sub: 'Net change across ADU pages',
      icon: TrendingUp,
      href: ADU_HUB,
    },
  ] as const



  const nonActiveListItems = stats.nonActivePages.map((p) => ({
    id: p.id,
    page_name: p.page_name,
    fb_page_image: p.fb_page_image,
    reason: p.reason,
    tone: p.tone,
  }))

  return (
    <div className="space-y-6">
      <DashboardRefreshButton lastFetched={lastFetched} />

      <DashboardSetupChecklist
        tokenTier={tokenTier}
        hasFacebookApp={hasFacebookApp}
        fbAccountsCount={fbAccountsCount}
        totalPages={stats.totalPages}
      />

      {showEmptyDelight ? (
        <AgencyEmptyState
          icon={<Download className="h-7 w-7" />}
          title="Add your first page"
          description="Connect Facebook BYOC, link an account, then add an Auto Download/Upload page to start automation."
          actionHref={{ label: 'Go to Auto Download/Upload', href: ADU_HUB }}
        />
      ) : (
        <div className="relative group">
          <div
            className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 to-blue-500/20 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100"
            aria-hidden
          />
          <div className="relative space-y-4 rounded-2xl border border-border/50 bg-card/40 p-5 shadow-2xl backdrop-blur-xl">
            <div className="grid gap-4 sm:grid-cols-3">
              {kpiCards.map((kpi) => {
                const Icon = kpi.icon
                return (
                  <Link
                    key={kpi.label}
                    href={kpi.href}
                    className="group/kpi rounded-xl border border-border/50 bg-background/30 p-4 transition-colors hover:border-primary/30 hover:bg-background/50"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <Icon className="h-4 w-4 text-primary" />
                        {kpi.label}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover/kpi:opacity-100" />
                    </div>
                    <p className="font-display text-2xl font-bold tracking-tight text-foreground">
                      {kpi.value}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{kpi.sub}</p>
                  </Link>
                )
              })}
            </div>

            {hasTokens ? (
              <DashboardScheduleSnapshot
                inAppPending={inAppPending ?? 0}
                directScheduled={directScheduled ?? 0}
              />
            ) : null}


          </div>
        </div>
      )}

      <AgencySectionCard>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-primary/90">
            {attentionMeta.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="flex flex-wrap items-center gap-3">
            <AgencyInlineStatus label={health.label} tone={health.tone} />
            {attentionMeta.showAllClear && hasTokens ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                Every connected page is active
              </span>
            ) : null}
          </div>
          {stats.nonActivePages.length > 0 ? (
            <NeedsAttentionListClient
              pages={nonActiveListItems}
              totalCount={stats.nonActiveCount}
            />
          ) : null}
        </CardContent>
      </AgencySectionCard>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Quick links
        </h2>
        {hasTokens ? (
          <DashboardQuickLinks hasTokens rssAutoposterEnabled={rssAutoposterEnabled} />
        ) : (
          <DashboardQuickLinksLocked />
        )}
      </div>
    </div>
  )
}
