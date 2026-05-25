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

function PipelineFunnelBar({
  pending,
  downloaded,
  posted,
  failed,
}: {
  pending: number
  downloaded: number
  posted: number
  failed: number
}) {
  const total = pending + downloaded + posted + failed
  if (total === 0) {
    return (
      <p className="text-xs text-muted-foreground">No reels in pipeline yet.</p>
    )
  }

  const segments = [
    { key: 'pending', value: pending, className: 'bg-amber-500/80' },
    { key: 'downloaded', value: downloaded, className: 'bg-blue-500/80' },
    { key: 'posted', value: posted, className: 'bg-primary/80' },
  ] as const

  return (
    <div className="space-y-2">
      <div className="flex h-2 overflow-hidden rounded-full bg-muted/50">
        {segments.map((seg) => {
          const pct = (seg.value / total) * 100
          if (pct <= 0) return null
          return (
            <div
              key={seg.key}
              className={cn('h-full transition-all', seg.className)}
              style={{ width: `${pct}%` }}
              title={`${seg.key}: ${seg.value}`}
            />
          )
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-amber-500/80" />
          Pending → Downloaded → Posted
        </span>
        {failed > 0 ? (
          <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-destructive">
            Failed {failed.toLocaleString()}
          </span>
        ) : null}
      </div>
    </div>
  )
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
    { count: downloadedReelsCount, error: downloadedReelsError },
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
      .from('reels')
      .select('id, pages!inner(agency_id)', { count: 'exact', head: true })
      .eq('status', 'downloaded')
      .eq('pages.agency_id', userId),
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
  const downloadedReels =
    downloadedReelsError != null ? 0 : (downloadedReelsCount ?? 0)
  const stats = aggregateOverviewStats(pages, downloadedReels)
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

  const aduPipelineMetrics = [
    {
      label: 'Pending',
      value: stats.pendingReels,
      percent: stats.pipelinePercents.pending,
      description: 'Discovered on source, not downloaded yet',
      href: `${ADU_HUB}?reelStatus=pending`,
    },
    {
      label: 'Downloaded',
      value: stats.downloadedReels,
      percent: stats.pipelinePercents.downloaded,
      description: 'Downloaded and in queue, waiting to be published',
      href: `${ADU_HUB}?reelStatus=downloaded`,
    },
    {
      label: 'Posted',
      value: stats.postedReels,
      percent: stats.pipelinePercents.posted,
      description: 'Successfully published to Facebook',
      href: `${ADU_HUB}?reelStatus=posted`,
    },
    {
      label: 'Failed',
      value: stats.failedReels,
      percent: stats.pipelinePercents.failed,
      description: 'Failed to download or publish',
      href: `${ADU_HUB}?reelStatus=failed`,
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

            <div className="rounded-xl border border-border/50 bg-background/30 p-4">
              <div className="mb-4 flex items-start gap-2">
                <Download className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    ADU pipeline
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Reel totals across all Auto Download/Upload pages
                  </p>
                </div>
              </div>
              <div className="mb-4">
                <PipelineFunnelBar
                  pending={stats.pendingReels}
                  downloaded={stats.downloadedReels}
                  posted={stats.postedReels}
                  failed={stats.failedReels}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {aduPipelineMetrics.map((metric) => (
                  <Link
                    key={metric.label}
                    href={metric.href}
                    className="group/metric rounded-lg border border-border/40 bg-card/50 px-4 py-3 transition-colors hover:border-primary/30"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {metric.label}
                    </p>
                    <p className="mt-1 font-display text-2xl font-bold tabular-nums tracking-tight text-foreground">
                      {metric.value.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {stats.totalReels > 0 ? `${metric.percent}% of reels` : '—'}
                    </p>
                    <p className="mt-1 text-xs leading-snug text-muted-foreground">
                      {metric.description}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
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
