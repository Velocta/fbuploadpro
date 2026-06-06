export const TOKEN_LOW_THRESHOLD = 1000

export type TokenBalanceTier = 'zero' | 'low' | 'ok'

export function deriveTokenBalanceTier(balance: number): TokenBalanceTier {
  if (balance <= 0) return 'zero'
  if (balance < TOKEN_LOW_THRESHOLD) return 'low'
  return 'ok'
}

export function tokenBalanceKpiSubcopy(balance: number): string {
  const tier = deriveTokenBalanceTier(balance)
  if (tier === 'zero') return 'Add tokens to unlock features'
  if (tier === 'low') return 'Below 1,000 — contact tool owner to upgrade'
  return 'Available for automation'
}

export type OverviewPageRow = {
  id: string
  page_name: string
  fb_page_image: string | null
  status: string | null
  sync_status: string | null
  pending_reels_count: number | null
  posted_reels_count: number | null
  failed_reels_count: number | null
  followers_count: number | null
  followers_gained: number | null
}

const STATUS_LABELS: Record<string, string> = {
  inactive: 'Inactive',
  invalid_token: 'Invalid token',
  invalid_username: 'Invalid username',
  fb_verification_required: 'Verification required',
  completed: 'Completed',
  '2fa_required_on_BM': '2FA required on BM',
  check_developer_app: 'Check developer app',
  account_suspended: 'Account suspended',
  creator_suspended: 'Creator suspended',
}

export type NonActivePageTone = 'success' | 'destructive'

/** Pages whose profile status is not `active`. */
export function pageNonActiveStatusDisplay(
  page: OverviewPageRow,
): { reason: string; tone: NonActivePageTone } | null {
  if (!page.status || page.status === 'active') return null
  const reason = STATUS_LABELS[page.status] ?? page.status.replace(/_/g, ' ')
  const tone: NonActivePageTone = page.status === 'completed' ? 'success' : 'destructive'
  return { reason, tone }
}

export function aggregateOverviewStats(pages: OverviewPageRow[], downloadedReels: number) {
  let pendingReels = 0
  let postedReels = 0
  let failedReels = 0
  let activePages = 0
  let totalFollowersGained = 0

  const nonActivePages: Array<OverviewPageRow & { reason: string; tone: NonActivePageTone }> = []

  for (const page of pages) {
    pendingReels += page.pending_reels_count ?? 0
    postedReels += page.posted_reels_count ?? 0
    failedReels += page.failed_reels_count ?? 0
    if (page.status === 'active') activePages += 1
    totalFollowersGained += Math.max((page.followers_gained ?? 0) - (page.followers_count ?? 0), 0)

    const display = pageNonActiveStatusDisplay(page)
    if (display) nonActivePages.push({ ...page, reason: display.reason, tone: display.tone })
  }

  nonActivePages.sort((a, b) => a.page_name.localeCompare(b.page_name))

  const totalReels = pendingReels + downloadedReels + postedReels + failedReels

  const pipelinePercents = {
    pending: totalReels > 0 ? Math.round((pendingReels / totalReels) * 100) : 0,
    downloaded: totalReels > 0 ? Math.round((downloadedReels / totalReels) * 100) : 0,
    posted: totalReels > 0 ? Math.round((postedReels / totalReels) * 100) : 0,
    failed: totalReels > 0 ? Math.round((failedReels / totalReels) * 100) : 0,
  }

  return {
    totalPages: pages.length,
    activePages,
    pendingReels,
    downloadedReels,
    postedReels,
    failedReels,
    totalReels,
    pipelinePercents,
    totalFollowersGained,
    nonActivePages,
    nonActiveCount: nonActivePages.length,
  }
}

export function deriveAttentionSectionTitle(
  nonActiveCount: number,
  scheduleAttentionCount: number,
): { title: string; showAllClear: boolean } {
  const total = nonActiveCount + scheduleAttentionCount
  if (total === 0) {
    return { title: 'All systems go', showAllClear: true }
  }
  return { title: `Needs attention (${total})`, showAllClear: false }
}

export function hasFacebookByocConfigured(settings: {
  fb_app_id: string | null
  fb_app_secret: string | null
} | null): boolean {
  return Boolean(settings?.fb_app_id?.trim() && settings?.fb_app_secret?.trim())
}

export function deriveAutomationHealth(
  hasTokens: boolean,
  nonActiveCount: number,
): { label: string; tone: 'default' | 'muted' | 'destructive' } {
  if (!hasTokens) {
    return { label: 'No tokens — automation paused', tone: 'destructive' }
  }
  if (nonActiveCount > 0) {
    return {
      label: `${nonActiveCount} page${nonActiveCount === 1 ? '' : 's'} not active`,
      tone: 'destructive',
    }
  }
  return { label: 'All pages active', tone: 'default' }
}
